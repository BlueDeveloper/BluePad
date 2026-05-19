import { useState, useCallback, useRef, useEffect } from "react";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { readTextFile as readTextFileRaw, writeTextFile, stat } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

// Milkdown/ProseMirror가 CRLF를 일부 노드에서 처리 못 해 렌더링 깨짐 (Windows에서
// 자동 생성된 markdown은 CRLF인 경우 多). 모든 파일 읽기에서 LF로 정규화.
async function readTextNormalized(path: string): Promise<string> {
  let text = await readTextFileRaw(path);
  // UTF-8 BOM (Windows Notepad 등) 제거 — 첫 문자에 있으면 Milkdown 첫 헤딩 파싱 깨짐
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  // CRLF/CR → LF (Milkdown은 LF만 안전 처리)
  return text.replace(/\r\n?/g, "\n");
}

// 큰 파일 경고 임계값 (5 MB). 그 이상은 Milkdown 라운드트립이 매우 느려짐.
const LARGE_FILE_BYTES = 5 * 1024 * 1024;

// 경로 비교용 정규화: backslash → slash + Windows 대소문자 무시.
// 같은 파일이 Tauri dialog(C:\path)와 파일트리(C:/path) 등 다른 형식으로 들어와도
// 중복 탭을 막을 수 있다.
function pathKey(p: string | null | undefined): string {
  if (!p) return "";
  return p.replace(/\\/g, "/").toLowerCase();
}

interface DialogLabels {
  unsavedChanges: string;
  saveClose: string;
  close: string;
  dontSave?: string;
  cancel?: string;
}

export type FileType = "markdown" | "json" | "yaml" | "text";

export interface Tab {
  id: string;
  filePath: string | null;
  fileName: string;
  content: string;
  savedContent: string;
  isModified: boolean;
  fileVersion: number;
  fileType: FileType;
}

function detectFileType(filePath: string | null): FileType {
  if (!filePath) return "markdown";
  const ext = filePath.replace(/\\/g, "/").split("/").pop()?.split(".").pop()?.toLowerCase() || "";
  if (["json", "jsonc"].includes(ext)) return "json";
  if (["yaml", "yml"].includes(ext)) return "yaml";
  if (["txt", "log", "env", "ini", "conf", "cfg", "properties"].includes(ext)) return "text";
  return "markdown";
}

let tabIdCounter = 0;
function nextTabId() {
  return `tab-${++tabIdCounter}`;
}

function createTab(overrides?: Partial<Tab>): Tab {
  const filePath = overrides?.filePath ?? null;
  return {
    id: nextTabId(),
    filePath,
    fileName: "Untitled",
    content: "",
    savedContent: "",
    isModified: false,
    fileVersion: 0,
    fileType: overrides?.fileType ?? detectFileType(filePath),
    ...overrides,
  };
}

const extractName = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "Untitled";
};

const TABS_STORAGE_KEY = "bluepad_open_tabs";
const ACTIVE_TAB_KEY = "bluepad_active_tab";

interface SavedTabInfo {
  filePath: string;
  fileName: string;
  fileType: FileType;
}

function loadSavedTabs(): { tabs: Tab[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_TAB_KEY);
    if (!raw) return { tabs: [], activeId: null };
    const saved: SavedTabInfo[] = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return { tabs: [], activeId: null };
    const tabs = saved.map((s) =>
      createTab({ filePath: s.filePath, fileName: s.fileName, fileType: s.fileType })
    );
    return { tabs, activeId };
  } catch {
    return { tabs: [], activeId: null };
  }
}

export function useFileManager() {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const { tabs: saved } = loadSavedTabs();
    return saved.length > 0 ? saved : [createTab()];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const { tabs: saved, activeId } = loadSavedTabs();
    if (saved.length > 0) {
      // activeId에 해당하는 filePath를 가진 탭 찾기
      if (activeId) {
        const match = saved.find((t) => t.filePath === activeId);
        if (match) return match.id;
      }
      return saved[0].id;
    }
    return tabs[0]?.id || "";
  });
  const contentRef = useRef("");
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  const dialogLabelsRef = useRef<DialogLabels>({
    unsavedChanges: "에 저장하지 않은 변경사항이 있습니다.\n저장하시겠습니까?",
    saveClose: "저장하고 닫기",
    close: "닫기",
  });

  const setDialogLabels = useCallback((labels: DialogLabels) => {
    dialogLabelsRef.current = labels;
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  contentRef.current = activeTab.content;

  // Helper to update a specific tab
  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }, []);

  // CLI file open on startup
  useEffect(() => {
    invoke<string | null>("get_cli_file_path").then(async (path) => {
      if (path) {
        try {
          const text = await readTextNormalized(path);
          const name = extractName(path);
          const fType = detectFileType(path);
          // Replace the initial empty tab
          setTabs((prev) => {
            const first = prev[0];
            if (prev.length === 1 && !first.filePath && !first.isModified && first.content === "") {
              return [{ ...first, filePath: path, fileName: name, content: text, savedContent: text, fileType: fType, fileVersion: first.fileVersion + 1 }];
            }
            const newTab = createTab({ filePath: path, fileName: name, content: text, savedContent: text, fileType: fType, fileVersion: 1 });
            return [...prev, newTab];
          });
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const setContent = useCallback(
    (newContent: string) => {
      contentRef.current = newContent;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabIdRef.current
            ? { ...t, content: newContent, isModified: newContent !== t.savedContent }
            : t
        )
      );
    },
    []
  );

  const newFile = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const loadFileFromPath = useCallback(
    async (path: string) => {
      // 입력 경로를 forward-slash로 통일 (저장 형태 일관성)
      const normalizedPath = path.replace(/\\/g, "/");
      const key = pathKey(normalizedPath);

      // 이미 같은 파일이 열려 있으면 그 탭으로 전환 (파일 read 자체 skip)
      const alreadyOpen = tabsRef.current.find((t) => pathKey(t.filePath) === key);
      if (alreadyOpen) {
        setActiveTabId(alreadyOpen.id);
        return;
      }

      // 큰 파일 경고 — Milkdown은 5MB+ 부터 라운드트립이 느려짐. 사용자 확인 후 진행
      try {
        const info = await stat(normalizedPath);
        if (info.size > LARGE_FILE_BYTES) {
          const mb = (info.size / 1024 / 1024).toFixed(1);
          const proceed = await ask(
            `이 파일은 ${mb} MB 입니다. 에디터가 매우 느려질 수 있습니다.\n그래도 열까요?`,
            { title: "큰 파일 경고", kind: "warning" }
          );
          if (!proceed) return;
        }
      } catch { /* stat 실패해도 진행 */ }

      const text = await readTextNormalized(normalizedPath);
      const name = extractName(normalizedPath);
      const fType = detectFileType(normalizedPath);

      setTabs((prev) => {
        // 비동기 read 동안 동시 호출로 중복 탭 생성될 수 있어 한 번 더 확인
        const existing = prev.find((t) => pathKey(t.filePath) === key);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }

        // Find current active tab to check if it's empty & reusable
        const active = prev.find((t) => t.id === activeTabIdRef.current);

        if (active && !active.filePath && !active.isModified && active.content === "") {
          // Reuse current empty tab
          return prev.map((t) =>
            t.id === active.id
              ? { ...t, filePath: normalizedPath, fileName: name, content: text, savedContent: text, fileType: fType, isModified: false, fileVersion: t.fileVersion + 1 }
              : t
          );
        } else {
          // Create new tab
          const tab = createTab({ filePath: normalizedPath, fileName: name, content: text, savedContent: text, fileType: fType, fileVersion: 1 });
          setActiveTabId(tab.id);
          return [...prev, tab];
        }
      });
    },
    []
  );

  const openFile = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdx"] },
        { name: "JSON", extensions: ["json", "jsonc"] },
        { name: "YAML", extensions: ["yaml", "yml"] },
        { name: "Text", extensions: ["txt", "log"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      for (const path of paths) {
        await loadFileFromPath(path);
      }
    }
  }, [loadFileFromPath]);


  const saveFile = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab) return;

    if (tab.filePath) {
      await writeTextFile(tab.filePath, tab.content);
      updateTab(tab.id, { savedContent: tab.content, isModified: false });
    } else {
      const selected = await save({
        filters: [
          { name: "Markdown", extensions: ["md"] },
          { name: "JSON", extensions: ["json"] },
          { name: "YAML", extensions: ["yaml", "yml"] },
          { name: "Text", extensions: ["txt"] },
        ],
      });
      if (selected) {
        await writeTextFile(selected, tab.content);
        updateTab(tab.id, {
          filePath: selected,
          fileName: extractName(selected),
          savedContent: tab.content,
          isModified: false,
          fileType: detectFileType(selected),
        });
      }
    }
  }, [updateTab]);

  const saveFileAs = useCallback(async () => {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab) return;

    const selected = await save({
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "JSON", extensions: ["json"] },
        { name: "YAML", extensions: ["yaml", "yml"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });
    if (selected) {
      await writeTextFile(selected, tab.content);
      updateTab(tab.id, {
        filePath: selected,
        fileName: extractName(selected),
        savedContent: tab.content,
        isModified: false,
        fileType: detectFileType(selected),
      });
    }
  }, [updateTab]);

  const doCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) {
          const newTab = createTab();
          setActiveTabId(newTab.id);
          return [newTab];
        }
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabIdRef.current) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        }
        return next;
      });
    },
    []
  );

  const closeTab = useCallback(
    async (tabId: string) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (tab && tab.isModified) {
        const labels = dialogLabelsRef.current;
        const saveAndClose = await ask(`"${tab.fileName}"${labels.unsavedChanges}`, {
          title: "BluePad",
          kind: "warning",
          okLabel: labels.saveClose,
          cancelLabel: labels.close,
        });
        if (saveAndClose) {
          // 저장 후 닫기
          if (tab.filePath) {
            await writeTextFile(tab.filePath, tab.content);
            updateTab(tab.id, { savedContent: tab.content, isModified: false });
          } else {
            const selected = await save({
              filters: [
                { name: "Markdown", extensions: ["md"] },
                { name: "JSON", extensions: ["json"] },
                { name: "YAML", extensions: ["yaml", "yml"] },
                { name: "Text", extensions: ["txt"] },
              ],
            });
            if (!selected) return; // 저장 취소 → 닫지 않음
            await writeTextFile(selected, tab.content);
          }
        }
      }
      doCloseTab(tabId);
    },
    [doCloseTab, updateTab]
  );

  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const saveAllModified = useCallback(async () => {
    const current = tabsRef.current;
    for (const tab of current) {
      if (tab.isModified && tab.filePath) {
        await writeTextFile(tab.filePath, tab.content);
        updateTab(tab.id, { savedContent: tab.content, isModified: false });
      }
    }
  }, [updateTab]);

  const reorderTabs = useCallback((fromIdx: number, toIdx: number) => {
    setTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // 탭 상태 저장 (filePath가 있는 탭만)
  useEffect(() => {
    try {
      const toSave: SavedTabInfo[] = tabs
        .filter((t) => t.filePath)
        .map((t) => ({ filePath: t.filePath!, fileName: t.fileName, fileType: t.fileType }));
      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(toSave));
      const active = tabs.find((t) => t.id === activeTabId);
      if (active?.filePath) {
        localStorage.setItem(ACTIVE_TAB_KEY, active.filePath);
      }
    } catch { /* ignore */ }
  }, [tabs, activeTabId]);

  // 저장된 탭 파일 내용 로드 (최초 1회)
  const tabsLoaded = useRef(false);
  useEffect(() => {
    if (tabsLoaded.current) return;
    tabsLoaded.current = true;
    const loadContents = async () => {
      const savedActivePath = localStorage.getItem(ACTIVE_TAB_KEY);
      let foundActiveId = "";
      for (const tab of tabs) {
        if (tab.filePath && !tab.content) {
          try {
            const text = await readTextNormalized(tab.filePath);
            setTabs((prev) =>
              prev.map((t) =>
                t.id === tab.id
                  ? { ...t, content: text, savedContent: text, fileVersion: t.fileVersion + 1 }
                  : t
              )
            );
            if (tab.filePath === savedActivePath) {
              foundActiveId = tab.id;
            }
          } catch {
            // 파일 없으면 탭 제거
            setTabs((prev) => prev.filter((t) => t.id !== tab.id));
          }
        }
      }
      if (foundActiveId) {
        setActiveTabId(foundActiveId);
      }
    };
    if (tabs.some((t) => t.filePath && !t.content)) {
      loadContents();
    }
  }, []);

  return {
    // Active tab properties (backward compatible)
    filePath: activeTab.filePath,
    fileName: activeTab.fileName,
    isModified: activeTab.isModified,
    content: activeTab.content,
    fileVersion: activeTab.fileVersion,
    setContent,
    newFile,
    openFile,
    saveFile,
    saveFileAs,
    loadFileFromPath,
    saveAllModified,
    // Tab management
    tabs,
    activeTabId,
    activeTab,
    closeTab,
    switchTab,
    reorderTabs,
    setDialogLabels,
  };
}
