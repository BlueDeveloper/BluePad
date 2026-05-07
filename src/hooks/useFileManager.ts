import { useState, useCallback, useRef, useEffect } from "react";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

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

export function useFileManager() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const contentRef = useRef("");
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

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
          const text = await readTextFile(path);
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
      const text = await readTextFile(path);
      const name = extractName(path);
      const fType = detectFileType(path);

      setTabs((prev) => {
        // Check if file is already open in a tab
        const existing = prev.find((t) => t.filePath === path);
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
              ? { ...t, filePath: path, fileName: name, content: text, savedContent: text, fileType: fType, isModified: false, fileVersion: t.fileVersion + 1 }
              : t
          );
        } else {
          // Create new tab
          const tab = createTab({ filePath: path, fileName: name, content: text, savedContent: text, fileType: fType, fileVersion: 1 });
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

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

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
