import { useState, useEffect, useCallback } from "react";
import { readDir } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

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

const MD_EXTENSIONS = [".md", ".markdown", ".mdx", ".txt"];

export function FileTree({ visible, onOpenFile }: FileTreeProps) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);

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
          if (MD_EXTENSIONS.includes(ext)) {
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

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setRootPath(selected);
      const items = await loadDir(selected);
      setEntries(items);
    }
  }, [loadDir]);

  useEffect(() => {
    if (rootPath) loadDir(rootPath).then(setEntries);
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
    <div className="file-tree">
      <div className="file-tree-header">
        <span>파일</span>
        <button className="file-tree-open" onClick={openFolder} title="폴더 열기">
          &#128193;
        </button>
      </div>
      <div className="file-tree-content">
        {!rootPath ? (
          <div className="file-tree-empty" onClick={openFolder}>
            폴더를 열어주세요
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
