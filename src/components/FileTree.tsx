import { useState, useEffect, useCallback, useRef } from "react";
import { readDir } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../i18n";

interface FileTreeProps {
  visible: boolean;
  onOpenFile: (path: string) => void;
}

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
  expanded?: boolean;
}

const SUPPORTED_EXTENSIONS = [
  ".md", ".markdown", ".mdx",
  ".txt", ".log",
  ".json", ".jsonc",
  ".yaml", ".yml",
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
  ".html", ".htm", ".xhtml",
  ".css", ".scss", ".sass", ".less",
];

const FILETREE_ROOT_KEY = "bluepad_filetree_root";
const FILETREE_WIDTH_KEY = "bluepad_filetree_width";
const FILETREE_EXPANDED_KEY = "bluepad_filetree_expanded";
const MIN_WIDTH = 180;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 220;

/** localStorage에서 expanded path set 로드 */
function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(FILETREE_EXPANDED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((s) => typeof s === "string")) : new Set();
  } catch { return new Set(); }
}

function saveExpanded(set: Set<string>): void {
  try { localStorage.setItem(FILETREE_EXPANDED_KEY, JSON.stringify(Array.from(set))); } catch { /* ignore */ }
}

/** entries 트리에서 expanded인 모든 디렉토리 path 수집 */
function collectExpanded(list: FileEntry[], out: Set<string> = new Set()): Set<string> {
  for (const e of list) {
    if (e.isDir && e.expanded) {
      out.add(e.path);
      if (e.children) collectExpanded(e.children, out);
    }
  }
  return out;
}

export function FileTree({ visible, onOpenFile }: FileTreeProps) {
  const { t } = useI18n();
  const [rootPath, setRootPath] = useState<string | null>(() => {
    try { return localStorage.getItem(FILETREE_ROOT_KEY); } catch { return null; }
  });
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem(FILETREE_WIDTH_KEY) || "", 10);
      if (Number.isFinite(saved)) return Math.min(Math.max(saved, MIN_WIDTH), MAX_WIDTH);
    } catch { /* ignore */ }
    return DEFAULT_WIDTH;
  });
  const widthRef = useRef(width);
  widthRef.current = width;

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(Math.max(startW + (ev.clientX - startX), MIN_WIDTH), MAX_WIDTH);
      setWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      try { localStorage.setItem(FILETREE_WIDTH_KEY, String(widthRef.current)); } catch { /* ignore */ }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ew-resize";
  }, []);

  const loadDir = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
    try {
      const items = await readDir(dirPath);
      const result: FileEntry[] = [];

      for (const item of items) {
        const name = item.name || "";
        if (name.startsWith(".")) continue;
        const fullPath = dirPath.replace(/\\/g, "/") + "/" + name;

        if (item.isDirectory) {
          result.push({ name, path: fullPath, isDir: true, children: [], expanded: false });
        } else {
          const ext = "." + name.split(".").pop()?.toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            result.push({ name, path: fullPath, isDir: false });
          }
        }
      }

      result.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    } catch {
      return [];
    }
  }, []);

  /** localStorage의 expanded path set을 기반으로 자식 트리까지 펼친 entries 생성.
   *  메모리 old entries에 의존하지 않으므로 F5 reload 후에도 동일하게 동작. */
  const expandFromSet = useCallback(async (fresh: FileEntry[], expandedSet: Set<string>): Promise<FileEntry[]> => {
    const result: FileEntry[] = [];
    for (const f of fresh) {
      if (f.isDir && expandedSet.has(f.path)) {
        const children = await loadDir(f.path);
        const expandedChildren = await expandFromSet(children, expandedSet);
        result.push({ ...f, expanded: true, children: expandedChildren });
      } else {
        result.push(f);
      }
    }
    return result;
  }, [loadDir]);

  const refreshTree = useCallback(async () => {
    if (!rootPath) return;
    const fresh = await loadDir(rootPath);
    // 메모리 entries가 아니라 localStorage set에서 expanded 가져오기 (F5 reload 안전)
    const expanded = collectExpanded(entries);
    // 메모리에 없는 케이스(F5 직후 등) 대비 localStorage도 합치기
    for (const p of loadExpanded()) expanded.add(p);
    const restored = await expandFromSet(fresh, expanded);
    setEntries(restored);
  }, [rootPath, entries, loadDir, expandFromSet]);

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (!selected) return;
    // 동일 폴더 다시 선택 시 expanded 보존 (path 정규화 후 비교)
    const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    if (rootPath && norm(selected) === norm(rootPath)) {
      const fresh = await loadDir(selected);
      const expanded = collectExpanded(entries);
      for (const p of loadExpanded()) expanded.add(p);
      const restored = await expandFromSet(fresh, expanded);
      setEntries(restored);
      return;
    }
    // 다른 폴더로 전환 시 expanded set 클리어
    saveExpanded(new Set());
    setRootPath(selected);
    try { localStorage.setItem(FILETREE_ROOT_KEY, selected); } catch { /* ignore */ }
    const items = await loadDir(selected);
    setEntries(items);
  }, [loadDir, expandFromSet, rootPath, entries]);

  useEffect(() => {
    if (!rootPath) return;
    loadDir(rootPath)
      .then(async (fresh) => {
        // 마운트 시 localStorage의 expanded set으로 복원 (F5 reload 또는 앱 재시작 후)
        const restored = await expandFromSet(fresh, loadExpanded());
        setEntries(restored);
      })
      .catch(() => {
        setRootPath(null);
        setEntries([]);
        try { localStorage.removeItem(FILETREE_ROOT_KEY); } catch { /* ignore */ }
      });
  }, [rootPath, loadDir, expandFromSet]);

  // F5 / Ctrl+R 가로채기 → 페이지 reload 대신 우리 refreshTree 사용 (열어둔 트리 보존)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.ctrlKey && (e.key === "r" || e.key === "R"))) {
        e.preventDefault();
        e.stopPropagation();
        refreshTree();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [refreshTree]);

  const toggleDir = useCallback(
    async (_entry: FileEntry, path: number[]) => {
      const newEntries = [...entries];
      let current = newEntries;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]].children!;
      }
      const target = current[path[path.length - 1]];

      if (!target.expanded) {
        target.children = await loadDir(target.path);
        target.expanded = true;
      } else {
        target.expanded = false;
      }
      setEntries([...newEntries]);
      // localStorage에 expanded set 저장 (F5/재시작 시 복원용)
      saveExpanded(collectExpanded(newEntries));
    },
    [entries, loadDir]
  );

  if (!visible) return null;

  return (
    <div className="file-tree" style={{ width, minWidth: width, flexShrink: 0 }}>
      <div className="file-tree-resize-handle" onMouseDown={startResize} title="드래그하여 너비 조정" />
      <div className="file-tree-header">
        <span>{t("fileTree.files")}</span>
        <div className="file-tree-header-actions">
          <button className="file-tree-open file-tree-refresh" onClick={refreshTree} title={t("fileTree.refresh")} disabled={!rootPath} aria-label="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path>
              <path d="M21 3v5h-5"></path>
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path>
              <path d="M3 21v-5h5"></path>
            </svg>
          </button>
          <button className="file-tree-open" onClick={openFolder} title={t("fileTree.openFolder")} aria-label="open folder">
            &#128193;
          </button>
        </div>
      </div>
      {rootPath && (
        <div className="file-tree-rootpath" title={rootPath.replace(/\\/g, "/")}>
          <span className="file-tree-rootpath-icon">&#128194;</span>
          <span className="file-tree-rootpath-text">{rootPath.replace(/\\/g, "/")}</span>
        </div>
      )}
      <div className="file-tree-content">
        {!rootPath ? (
          <div className="file-tree-empty" onClick={openFolder}>
            {t("fileTree.pleaseOpen")}
          </div>
        ) : (
          <EntryList
            entries={entries}
            path={[]}
            onToggle={toggleDir}
            onOpen={onOpenFile}
          />
        )}
      </div>
    </div>
  );
}

function EntryList({
  entries,
  path,
  onToggle,
  onOpen,
}: {
  entries: FileEntry[];
  path: number[];
  onToggle: (entry: FileEntry, path: number[]) => void;
  onOpen: (path: string) => void;
}) {
  return (
    <>
      {entries.map((entry, i) => {
        const currentPath = [...path, i];
        if (entry.isDir) {
          return (
            <div key={entry.path}>
              <div
                className="file-tree-item file-tree-dir"
                onClick={() => onToggle(entry, currentPath)}
              >
                <span className="file-tree-arrow">{entry.expanded ? "▾" : "▸"}</span>
                <span className="file-tree-icon">&#128193;</span>
                <span className="file-tree-name">{entry.name}</span>
              </div>
              {entry.expanded && entry.children && (
                <div className="file-tree-children">
                  <EntryList
                    entries={entry.children}
                    path={currentPath}
                    onToggle={onToggle}
                    onOpen={onOpen}
                  />
                </div>
              )}
            </div>
          );
        }
        return (
          <div
            key={entry.path}
            className="file-tree-item file-tree-file"
            onClick={() => onOpen(entry.path)}
          >
            <span className="file-tree-icon">&#128196;</span>
            <span className="file-tree-name">{entry.name}</span>
          </div>
        );
      })}
    </>
  );
}
