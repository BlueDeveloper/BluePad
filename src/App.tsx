import { useState, useCallback, useRef, useEffect } from "react";
import { MenuBar } from "./components/MenuBar";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { SourceEditor } from "./components/SourceEditor";
import { Sidebar } from "./components/Sidebar";
import { FileTree } from "./components/FileTree";
import { StatusBar } from "./components/StatusBar";
import { FindReplace } from "./components/FindReplace";
import { useFileManager } from "./hooks/useFileManager";
import type { EditorHandle } from "./types";
import { readTextFile } from "@tauri-apps/plugin-fs";

const RECENT_KEY = "bluepad_recent_files";
const FONT_SIZE_KEY = "bluepad_font_size";
const THEME_KEY = "bluepad_theme";
const AUTO_SAVE_INTERVAL = 30000; // 30초

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
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem(FONT_SIZE_KEY) || "15", 10);
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const editorRef = useRef<EditorHandle>(null);
  const fileManager = useFileManager();

  // 최근 파일 추가
  const addRecentFile = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((p) => p !== path);
      const next = [path, ...filtered].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // 파일 열기 시 최근 파일 등록
  useEffect(() => {
    if (fileManager.filePath) {
      addRecentFile(fileManager.filePath);
    }
  }, [fileManager.filePath, addRecentFile]);

  // 자동 저장
  useEffect(() => {
    if (!autoSaveEnabled || !fileManager.filePath || !fileManager.isModified) return;
    const timer = setInterval(() => {
      if (fileManager.isModified && fileManager.filePath) {
        fileManager.saveFile();
      }
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [autoSaveEnabled, fileManager]);

  // 글꼴 크기 저장
  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
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
<html lang="ko">
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
  }, [fileManager.fileName]);

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
        const text = await readTextFile(path);
        fileManager.setContent(text);
        // Trigger file load through useFileManager's internal method won't work here
        // So we use the exposed loadFile if available, or call openFile flow
        // For now, we'll use a workaround by calling the internal state setters
        // This is handled by the fileManager hook directly
      } catch {
        // File might not exist anymore, remove from recent
        setRecentFiles((prev) => {
          const next = prev.filter((p) => p !== path);
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeFontSize]);

  // ESC로 집중모드 해제 + fullscreen 동기화
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
    <div className={`app ${focusMode ? "focus-mode" : ""}`}>
      {focusMode && (
        <div className="focus-exit-zone">
          <div className="focus-exit-bar">
            <span>집중 모드</span>
            <button className="focus-exit-btn" onClick={handleToggleFocus}>
              ESC로 해제
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
          onNew={fileManager.newFile}
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
        />
      )}
      {!focusMode && <Toolbar editorRef={editorRef} sourceMode={sourceMode} />}
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
            <SourceEditor content={fileManager.content} onChange={handleContentChange} />
          ) : (
            <Editor
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
        />
      )}
    </div>
  );
}

export default App;
