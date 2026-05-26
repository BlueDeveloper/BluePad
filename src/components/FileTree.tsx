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
const MIN_WIDTH = 180;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 220;

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

  /** 신규 목록 위에 기존 expanded 상태 + 자식 트리 재적용 */
  const mergeExpanded = useCallback(async (fresh: FileEntry[], old: FileEntry[]): Promise<FileEntry[]> => {
    const oldByPath = new Map<string, FileEntry>();
    for (const e of old) oldByPath.set(e.path, e);

    const merged: FileEntry[] = [];
    for (const f of fresh) {
      const o = oldByPath.get(f.path);
      if (f.isDir && o?.expanded) {
        // 디스크에서 최신 자식 목록 다시 읽고, 기존 expanded 정보를 재귀 병합
        const freshChildren = await loadDir(f.path);
        const mergedChildren = await mergeExpanded(freshChildren, o.children || []);
        merged.push({ ...f, expanded: true, children: mergedChildren });
      } else {
        merged.push(f);
      }
    }
    return merged;
  }, [loadDir]);

  const refreshTree = useCallback(async () => {
    if (!rootPath) return;
    const fresh = await loadDir(rootPath);
    const merged = await mergeExpanded(fresh, entries);
    setEntries(merged);
  }, [rootPath, entries, loadDir, mergeExpanded]);

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (!selected) return;
    // 동일 폴더 다시 선택 시 expanded 보존
    if (selected === rootPath) {
      const fresh = await loadDir(selected);
      const merged = await mergeExpanded(fresh, entries);
      setEntries(merged);
      return;
    }
    setRootPath(selected);
    try { localStorage.setItem(FILETREE_ROOT_KEY, selected); } catch { /* ignore */ }
    const items = await loadDir(selected);
    setEntries(items);
  }, [loadDir, mergeExpanded, rootPath, entries]);

  useEffect(() => {
    if (rootPath) loadDir(rootPath).then(setEntries).catch(() => {
      // 저장된 폴더가 더 이상 없으면 초기화
      setRootPath(null);
      setEntries([]);
      try { localStorage.removeItem(FILETREE_ROOT_KEY); } catch { /* ignore */ }
    });
  }, [rootPath, loadDir]);

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
          <button className="file-tree-open" onClick={refreshTree} title={t("fileTree.refresh")} disabled={!rootPath}>
            &#x21bb;
          </button>
          <button className="file-tree-open" onClick={openFolder} title={t("fileTree.openFolder")}>
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
