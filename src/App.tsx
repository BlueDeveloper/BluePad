import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { MenuBar } from "./components/MenuBar";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { SourceEditor } from "./components/SourceEditor";
import { Sidebar } from "./components/Sidebar";
import { FileTree } from "./components/FileTree";
import { StatusBar } from "./components/StatusBar";
import { FindReplace } from "./components/FindReplace";
import { LicenseDialog } from "./components/LicenseDialog";
import { ProGate } from "./components/ProGate";
import { useFileManager } from "./hooks/useFileManager";
import { useLicense } from "./hooks/useLicense";
import { I18nCtx, t as translate } from "./i18n";
import type { Lang } from "./i18n";
import type { EditorHandle } from "./types";

const RECENT_KEY = "bluepad_recent_files";
const FONT_SIZE_KEY = "bluepad_font_size";
const THEME_KEY = "bluepad_theme";
const LANG_KEY = "bluepad_lang";
const AUTO_SAVE_INTERVAL = 30000;

const THEMES = [
  { id: "classic", label: "Classic" },
  { id: "brp-blue", label: "BRP Blue" },
  { id: "brp-red", label: "BRP Red" },
  { id: "brp-polarity", label: "BRP Polarity" },
] as const;

function App() {
  const [wordCount, setWordCount] = useState({ chars: 0, words: 0, lines: 0 });
  const [sourceMode, setSourceMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [fileTreeVisible, setFileTreeVisible] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [findVisible, setFindVisible] = useState(false);
  const [findReplaceMode, setFindReplaceMode] = useState(false);
  const [licenseDialogVisible, setLicenseDialogVisible] = useState(false);
  const [proGateVisible, setProGateVisible] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    try {
      return Math.max(10, Math.min(28, parseInt(localStorage.getItem(FONT_SIZE_KEY) || "15", 10)));
    } catch {
      return 15;
    }
  });
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "classic");
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || "ko");

  // i18n context
  const i18n = useMemo(() => ({
    lang,
    t: (key: Parameters<typeof translate>[1]) => translate(lang, key),
  }), [lang]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const editorRef = useRef<EditorHandle>(null);
  const fileManager = useFileManager();
  const license = useLicense();

  // Sync i18n dialog labels to useFileManager
  useEffect(() => {
    fileManager.setDialogLabels({
      unsavedChanges: i18n.t("dialog.unsavedChanges"),
      dontSave: i18n.t("dialog.dontSave"),
      cancel: i18n.t("dialog.cancel"),
    });
  }, [lang, fileManager.setDialogLabels, i18n]);

  // Tab limit for free users
  const handleNewTab = useCallback(() => {
    if (!license.isPro && fileManager.tabs.length >= license.maxTabs) {
      setProGateVisible(true);
      return;
    }
    fileManager.newFile();
  }, [license, fileManager]);

  // Recent files
  const addRecentFile = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((p) => p !== path);
      const next = [path, ...filtered].slice(0, 10);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (fileManager.filePath) {
      addRecentFile(fileManager.filePath);
    }
  }, [fileManager.filePath, addRecentFile]);

  // Auto save (all modified tabs, Pro only)
  useEffect(() => {
    if (!autoSaveEnabled || !license.isPro) return;
    const timer = setInterval(() => {
      fileManager.saveAllModified();
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [autoSaveEnabled, license.isPro, fileManager]);

  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* ignore */ }
  }, [fontSize]);

  const updateWordCount = useCallback((text: string) => {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split("\n").length;
    setWordCount({ chars, words, lines });
  }, []);

  const handleContentChange = useCallback(
    (markdown: string) => {
      fileManager.setContent(markdown);
      updateWordCount(markdown);
    },
    [fileManager, updateWordCount]
  );

  const handleExportHtml = useCallback(() => {
    const editorEl = document.querySelector(".editor-content");
    if (!editorEl) return;
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${fileManager.fileName}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.7; }
h1 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
h2 { border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #ddd; padding-left: 16px; color: #666; margin-left: 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; }
img { max-width: 100%; }
a { color: #4183c4; }
</style>
</head>
<body>
${editorEl.innerHTML}
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileManager.fileName.replace(/\.[^.]+$/, "") + ".html";
    a.click();
    URL.revokeObjectURL(url);
  }, [fileManager.fileName, lang]);

  const handleToggleFocus = useCallback(() => {
    setFocusMode((prev) => {
      if (!prev) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      return !prev;
    });
  }, []);

  const handleOpenRecentFile = useCallback(
    async (path: string) => {
      try {
        await fileManager.loadFileFromPath(path);
      } catch {
        setRecentFiles((prev) => {
          const next = prev.filter((p) => p !== path);
          try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      }
    },
    [fileManager]
  );

  const handleOpenFileFromTree = useCallback(
    async (path: string) => {
      try {
        await fileManager.loadFileFromPath(path);
      } catch {
        // ignore
      }
    },
    [fileManager]
  );

  const changeFontSize = useCallback((delta: number) => {
    setFontSize((s) => Math.max(10, Math.min(28, s + delta)));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        setFindReplaceMode(false);
        setFindVisible(true);
      } else if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        setFindReplaceMode(true);
        setFindVisible(true);
      } else if (e.ctrlKey && e.key === "=") {
        e.preventDefault();
        changeFontSize(1);
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        changeFontSize(-1);
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setFontSize(15);
      } else if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        fileManager.closeTab(fileManager.activeTabId);
      } else if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const tabsList = fileManager.tabs;
        if (tabsList.length <= 1) return;
        const idx = tabsList.findIndex((t) => t.id === fileManager.activeTabId);
        if (idx < 0) return;
        const nextIdx = e.shiftKey
          ? (idx - 1 + tabsList.length) % tabsList.length
          : (idx + 1) % tabsList.length;
        fileManager.switchTab(tabsList[nextIdx].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeFontSize, fileManager]);

  // ESC focus mode exit + fullscreen sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) {
        handleToggleFocus();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && focusMode) {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [focusMode, handleToggleFocus]);

  return (
    <I18nCtx.Provider value={i18n}>
      <div className={`app ${focusMode ? "focus-mode" : ""}`}>
        {focusMode && (
          <div className="focus-exit-zone">
            <div className="focus-exit-bar">
              <span>{i18n.t("focus.label")}</span>
              <button className="focus-exit-btn" onClick={handleToggleFocus}>
                {i18n.t("focus.exit")}
              </button>
            </div>
          </div>
        )}
        {!focusMode && (
          <MenuBar
            fileName={fileManager.fileName}
            isModified={fileManager.isModified}
            sourceMode={sourceMode}
            sidebarVisible={sidebarVisible}
            focusMode={focusMode}
            fileTreeVisible={fileTreeVisible}
            autoSaveEnabled={autoSaveEnabled}
            recentFiles={recentFiles}
            isPro={license.isPro}
            onNew={handleNewTab}
            onOpen={fileManager.openFile}
            onSave={fileManager.saveFile}
            onSaveAs={fileManager.saveFileAs}
            onExportHtml={handleExportHtml}
            onToggleSource={() => setSourceMode((s) => !s)}
            onToggleSidebar={() => setSidebarVisible((s) => !s)}
            onToggleFocus={handleToggleFocus}
            onToggleFileTree={() => setFileTreeVisible((s) => !s)}
            onToggleAutoSave={() => setAutoSaveEnabled((s) => !s)}
            onOpenRecent={handleOpenRecentFile}
            onFind={() => { setFindReplaceMode(false); setFindVisible(true); }}
            onReplace={() => { setFindReplaceMode(true); setFindVisible(true); }}
            onFontIncrease={() => changeFontSize(1)}
            onFontDecrease={() => changeFontSize(-1)}
            onFontReset={() => setFontSize(15)}
            fontSize={fontSize}
            theme={theme}
            themes={THEMES}
            onThemeChange={setTheme}
            lang={lang}
            onLangChange={setLang}
            onOpenLicense={() => setLicenseDialogVisible(true)}
            onProGate={() => setProGateVisible(true)}
          />
        )}
        {!focusMode && <Toolbar editorRef={editorRef} sourceMode={sourceMode} />}
        {!focusMode && (
          <TabBar
            tabs={fileManager.tabs}
            activeTabId={fileManager.activeTabId}
            onSwitch={fileManager.switchTab}
            onClose={fileManager.closeTab}
            onNew={handleNewTab}
            onReorder={fileManager.reorderTabs}
          />
        )}
        <div className="main-area">
          <FileTree visible={fileTreeVisible && !focusMode} onOpenFile={handleOpenFileFromTree} />
          <Sidebar visible={sidebarVisible && !focusMode} markdown={fileManager.content} />
          <div className="editor-wrapper">
            <FindReplace
              visible={findVisible && !sourceMode}
              replaceMode={findReplaceMode}
              onClose={() => setFindVisible(false)}
            />
            {sourceMode ? (
              <SourceEditor key={fileManager.activeTabId} content={fileManager.content} onChange={handleContentChange} />
            ) : (
              <Editor
                key={fileManager.activeTabId}
                ref={editorRef}
                content={fileManager.content}
                fileVersion={fileManager.fileVersion}
                fontSize={fontSize}
                onChange={handleContentChange}
              />
            )}
          </div>
        </div>
        {!focusMode && (
          <StatusBar
            chars={wordCount.chars}
            words={wordCount.words}
            lines={wordCount.lines}
            filePath={fileManager.filePath}
            sourceMode={sourceMode}
            autoSave={autoSaveEnabled}
            fontSize={fontSize}
            isPro={license.isPro}
          />
        )}
        <LicenseDialog
          visible={licenseDialogVisible}
          isPro={license.isPro}
          onActivate={license.activate}
          onDeactivate={license.deactivate}
          onClose={() => setLicenseDialogVisible(false)}
        />
        <ProGate
          visible={proGateVisible}
          onClose={() => setProGateVisible(false)}
          onOpenLicense={() => setLicenseDialogVisible(true)}
        />
      </div>
    </I18nCtx.Provider>
  );
}

export default App;
