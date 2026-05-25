import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { MenuBar } from "./components/MenuBar";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { SourceEditor } from "./components/SourceEditor";
import { CodeEditor, formatCode } from "./components/CodeEditor";
import { Sidebar } from "./components/Sidebar";
import { FileTree } from "./components/FileTree";
import { StatusBar } from "./components/StatusBar";
import { FindReplace } from "./components/FindReplace";
import { LicenseDialog } from "./components/LicenseDialog";
import { AboutDialog } from "./components/AboutDialog";
import { ProGate } from "./components/ProGate";
import { InputDialog } from "./components/InputDialog";
import { AlertDialog } from "./components/AlertDialog";
import { UpdateDialog } from "./components/UpdateDialog";
import { useFileManager } from "./hooks/useFileManager";
import { useLicense } from "./hooks/useLicense";
import { useUpdater } from "./hooks/useUpdater";
import { useWritingStats } from "./hooks/useWritingStats";
import { WritingPanel } from "./components/WritingPanel";
import { CHECKOUT_URL, IS_SANDBOX } from "./lib/env";
import { I18nCtx, t as translate } from "./i18n";
import type { Lang } from "./i18n";
import type { EditorHandle } from "./types";

/** Open external URL in system browser (Tauri) or new tab (web) */
function openExternal(url: string) {
  import("@tauri-apps/plugin-shell").then(m => m.open(url)).catch(() => window.open(url, "_blank"));
}

const RECENT_KEY = "bluepad_recent_files";
const FONT_SIZE_KEY = "bluepad_font_size";
const THEME_KEY = "bluepad_theme";
const LANG_KEY = "bluepad_lang";
const WORD_TARGET_KEY = "bluepad_word_target";
const LAST_VERSION_KEY = "bluepad_last_version";
const SOURCE_MODE_KEY = "bluepad_source_mode";
const SIDEBAR_KEY = "bluepad_sidebar";
const FILETREE_KEY = "bluepad_filetree";
const AUTOSAVE_KEY = "bluepad_autosave";
const ALWAYS_ON_TOP_KEY = "bluepad_always_on_top";
const WRITING_MODE_KEY = "bluepad_writing_mode";
const AUTO_SAVE_INTERVAL = 30000;
const APP_VERSION = __APP_VERSION__;

const THEMES = [
  { id: "classic", label: "Classic" },
  { id: "dark", label: "Dark" },
  { id: "brp-blue", label: "BRP Blue" },
  { id: "brp-red", label: "BRP Red" },
  { id: "brp-polarity", label: "BRP Polarity" },
] as const;

function App() {
  const [wordCount, setWordCount] = useState({ chars: 0, words: 0, lines: 0 });
  const [sourceMode, setSourceMode] = useState(() => {
    try { return localStorage.getItem(SOURCE_MODE_KEY) === "1"; } catch { return false; }
  });
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });
  const [fileTreeVisible, setFileTreeVisible] = useState(() => {
    try { return localStorage.getItem(FILETREE_KEY) === "1"; } catch { return false; }
  });
  const [focusMode, setFocusMode] = useState(false);
  const [writingMode, setWritingMode] = useState<boolean>(() => {
    try { return localStorage.getItem(WRITING_MODE_KEY) === "1"; } catch { return false; }
  });
  const [writingGoalDialogVisible, setWritingGoalDialogVisible] = useState(false);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const lastEditorScrollTop = useRef(0);

  // WYSIWYG ↔ SourceEditor의 scroll 컨테이너가 다름:
  //  - WYSIWYG: div.editor-content (overflow-y: auto)
  //  - SourceEditor: textarea.source-editor (자체 스크롤)
  // 두 케이스 모두 탐색.
  const findEditorScroller = useCallback((): HTMLElement | null => {
    const wrap = editorWrapperRef.current;
    if (!wrap) return null;
    return (
      (wrap.querySelector(".editor-content") as HTMLElement | null) ||
      (wrap.querySelector(".source-editor") as HTMLElement | null) ||
      null
    );
  }, []);

  const handleToggleSource = useCallback(() => {
    const cur = findEditorScroller();
    if (cur) lastEditorScrollTop.current = cur.scrollTop;
    setSourceMode((s) => !s);
  }, [findEditorScroller]);

  useEffect(() => {
    // 새 scroller 마운트 + Milkdown async 초기화 대기 — 여러 시점 재시도
    const timers: number[] = [];
    const restore = () => {
      const cur = findEditorScroller();
      if (cur) cur.scrollTop = lastEditorScrollTop.current;
    };
    // RAF + 50ms + 200ms 세 번 시도 (Milkdown ProseMirror 마운트 지연 대응)
    const raf = requestAnimationFrame(restore);
    timers.push(window.setTimeout(restore, 50));
    timers.push(window.setTimeout(restore, 200));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [sourceMode, findEditorScroller]);
  const [findVisible, setFindVisible] = useState(false);
  const [findReplaceMode, setFindReplaceMode] = useState(false);
  const [licenseDialogVisible, setLicenseDialogVisible] = useState(false);
  const [aboutDialogVisible, setAboutDialogVisible] = useState(false);
  const [proGateVisible, setProGateVisible] = useState(false);
  const [wordTargetDialogVisible, setWordTargetDialogVisible] = useState(false);
  const [trialWelcomeVisible, setTrialWelcomeVisible] = useState(false);
  const [trialExpiredVisible, setTrialExpiredVisible] = useState(false);
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
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try { const v = localStorage.getItem(AUTOSAVE_KEY); return v === null ? true : v === "1"; } catch { return true; }
  });
  const [wordTarget, setWordTarget] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(WORD_TARGET_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "classic");
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) || "ko");

  // i18n context
  const i18n = useMemo(() => ({
    lang,
    t: (key: Parameters<typeof translate>[1]) => translate(lang, key),
  }), [lang]);

  useEffect(() => {
    try { localStorage.setItem(SOURCE_MODE_KEY, sourceMode ? "1" : "0"); } catch {}
  }, [sourceMode]);
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, sidebarVisible ? "1" : "0"); } catch {}
  }, [sidebarVisible]);
  useEffect(() => {
    try { localStorage.setItem(FILETREE_KEY, fileTreeVisible ? "1" : "0"); } catch {}
  }, [fileTreeVisible]);
  useEffect(() => {
    try { localStorage.setItem(AUTOSAVE_KEY, autoSaveEnabled ? "1" : "0"); } catch {}
  }, [autoSaveEnabled]);
  useEffect(() => {
    try { localStorage.setItem(WRITING_MODE_KEY, writingMode ? "1" : "0"); } catch {}
  }, [writingMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const [alwaysOnTop, setAlwaysOnTop] = useState(() => {
    try { return localStorage.getItem(ALWAYS_ON_TOP_KEY) === "1"; } catch { return false; }
  });
  const [selectionCount, setSelectionCount] = useState(0);
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [whatsNewVersion, setWhatsNewVersion] = useState("");
  const [toast, setToast] = useState<string>("");
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 1800);
  }, []);
  const editorRef = useRef<EditorHandle>(null);
  const fileManager = useFileManager();
  const license = useLicense();
  const writingStats = useWritingStats(fileManager.content, writingMode && fileManager.activeTab.fileType === "markdown");
  const updater = useUpdater();

  // 업데이트 후 "새 소식" 알림
  useEffect(() => {
    try {
      const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
      if (lastVersion && lastVersion !== APP_VERSION) {
        setWhatsNewVersion(APP_VERSION);
        setWhatsNewVisible(true);
      }
      localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
    } catch { /* ignore */ }
  }, []);

  // 14일 체험 환영/만료 다이얼로그 (debounce로 서버 동기화 대기)
  const trialDialogShown = useRef(false);
  useEffect(() => {
    if (trialDialogShown.current) return;
    const timer = setTimeout(() => {
      if (trialDialogShown.current) return;
      trialDialogShown.current = true;

      if (!license.isPro && !license.isTrial && license.trialDaysLeft <= 0) {
        // localStorage로 이동 — 한 번 닫으면 영구 dismiss (앱 재시작마다 안 뜸)
        const expiredShown = localStorage.getItem("bluepad_trial_expired_shown");
        if (!expiredShown) {
          setTrialExpiredVisible(true);
          try { localStorage.setItem("bluepad_trial_expired_shown", "1"); } catch { /* ignore */ }
        }
      } else if (license.isTrial && license.trialDaysLeft <= 3 && license.trialDaysLeft > 0) {
        const soonShown = localStorage.getItem("bluepad_trial_expiring_shown");
        if (!soonShown) {
          setTrialExpiredVisible(true);
          try { localStorage.setItem("bluepad_trial_expiring_shown", "1"); } catch { /* ignore */ }
        }
      } else if (license.isTrial && license.trialDaysLeft > 3) {
        const welcomed = localStorage.getItem("bluepad_trial_welcomed");
        if (!welcomed) {
          setTrialWelcomeVisible(true);
          try { localStorage.setItem("bluepad_trial_welcomed", "1"); } catch { /* ignore */ }
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [license.isPro, license.isTrial, license.trialDaysLeft]);

  // Sync i18n dialog labels to useFileManager
  useEffect(() => {
    fileManager.setDialogLabels({
      unsavedChanges: i18n.t("dialog.unsavedChanges"),
      saveClose: i18n.t("dialog.saveClose"),
      close: i18n.t("dialog.close"),
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

  // Auto save (all modified tabs, available for all users)
  useEffect(() => {
    if (!autoSaveEnabled) return;
    const timer = setInterval(() => {
      fileManager.saveAllModified();
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [autoSaveEnabled, fileManager]);


  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)); } catch { /* ignore */ }
  }, [fontSize]);

  useEffect(() => {
    try {
      if (wordTarget !== null) {
        localStorage.setItem(WORD_TARGET_KEY, String(wordTarget));
      } else {
        localStorage.removeItem(WORD_TARGET_KEY);
      }
    } catch { /* ignore */ }
  }, [wordTarget]);

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

  const handleExportHtml = useCallback(async () => {
    const editorEl = document.querySelector(".editor-content");
    if (!editorEl) return;
    const htmlContent = `<!DOCTYPE html>
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
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const selected = await save({
        filters: [{ name: "HTML", extensions: ["html"] }],
        defaultPath: fileManager.fileName.replace(/\.[^.]+$/, "") + ".html",
      });
      if (selected) {
        await writeTextFile(selected, htmlContent);
      }
    } catch {
      // ignore
    }
  }, [fileManager.fileName, lang]);

  const handleExportPdf = useCallback(() => {
    if (!license.isPro) {
      setProGateVisible(true);
      return;
    }
    const editorEl = document.querySelector(".editor-content");
    if (!editorEl) return;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${fileManager.fileName}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.7; }
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
</html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 250);
  }, [license.isPro, fileManager.fileName, lang]);

  const handleSetWordTarget = useCallback(() => {
    setWordTargetDialogVisible(true);
  }, []);

  const handleWordTargetConfirm = useCallback((value: string) => {
    setWordTargetDialogVisible(false);
    const num = parseInt(value, 10);
    if (!num || num <= 0) {
      setWordTarget(null);
    } else {
      setWordTarget(num);
    }
  }, []);

  const handleFormat = useCallback(() => {
    const ft = fileManager.activeTab.fileType;
    if (ft !== "json" && ft !== "yaml") return;
    const { formatted, error } = formatCode(fileManager.content, ft);
    if (error) return; // invalid syntax, do nothing
    fileManager.setContent(formatted);
  }, [fileManager]);

  const handleToggleWritingMode = useCallback(() => {
    if (!license.isPro) {
      setProGateVisible(true);
      return;
    }
    setWritingMode((v) => !v);
  }, [license.isPro]);

  const handleCopyPlainText = useCallback(async () => {
    // markdown 외 파일에서도 동작하도록 가드 완화 — 텍스트/JSON/YAML/코드 모두 raw 클립보드 복사
    const ft = fileManager.activeTab.fileType;
    try {
      if (ft === "markdown" && editorRef.current) {
        const ok = await editorRef.current.copyAsPlainText();
        if (ok) { showToast(i18n.t("toast.copiedPlainText")); return; }
      }
      // markdown 외 / Editor 실패 시 — 현재 활성 탭 content를 그대로 클립보드에
      const raw = fileManager.content;
      if (raw && raw.trim()) {
        const isWindows = /Win/i.test(navigator.userAgent || "");
        const final = isWindows ? raw.replace(/\r?\n/g, "\r\n") : raw;
        await navigator.clipboard.writeText(final);
        showToast(i18n.t("toast.copiedPlainText"));
        return;
      }
      showToast(i18n.t("toast.copyFailed"));
    } catch {
      showToast(i18n.t("toast.copyFailed"));
    }
  }, [fileManager.activeTab.fileType, fileManager.content, showToast, i18n]);

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    try {
      localStorage.setItem(ALWAYS_ON_TOP_KEY, next ? "1" : "0");
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setAlwaysOnTop(next);
    } catch { /* ignore in web */ }
  }, [alwaysOnTop]);

  // 항상 위에 복원
  useEffect(() => {
    if (alwaysOnTop) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().setAlwaysOnTop(true);
      }).catch(() => {});
    }
  }, []);

  // 선택 글자수 감지
  useEffect(() => {
    const handle = () => {
      const sel = window.getSelection();
      setSelectionCount(sel?.toString().length || 0);
    };
    document.addEventListener("selectionchange", handle);
    return () => document.removeEventListener("selectionchange", handle);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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

  // Single-instance: 두 번째 BluePad 실행 시도(파일 더블클릭 등) → Rust가 "open-file"
  // emit → 기존 인스턴스가 받아서 새 탭으로 연다. 중복 파일은 useFileManager가 막아줌.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<string>("open-file", (event) => {
        const path = event.payload;
        if (path) fileManager.loadFileFromPath(path).catch(() => {});
      }).then((un) => { unlisten = un; });
    });
    return () => { if (unlisten) unlisten(); };
  }, [fileManager]);

  // 외부 파일 변경 감지 — window focus 시 활성 탭의 디스크 mtime 비교.
  // cron 등 외부 도구가 같은 파일을 갱신했을 때 사용자가 다시 읽을지 선택.
  useEffect(() => {
    const handler = () => { fileManager.reloadActiveTabIfChanged(); };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [fileManager]);

  // 드래그앤드롭: Windows 탐색기에서 BluePad 창으로 파일 드래그 시 새 탭으로 열림.
  // tauri.conf.json의 dragDropEnabled: true 필요.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          for (const p of event.payload.paths) {
            fileManager.loadFileFromPath(p).catch(() => {});
          }
        }
      }).then((un) => { unlisten = un; });
    });
    return () => { if (unlisten) unlisten(); };
  }, [fileManager]);

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
      } else if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        handlePrint();
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
  }, [changeFontSize, fileManager, handlePrint]);

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
      <div className={`app ${focusMode ? "focus-mode" : ""} ${IS_SANDBOX ? "sandbox-mode" : ""}`}>
        {IS_SANDBOX && <div className="sandbox-banner" title="Sandbox build — no real payments">SANDBOX</div>}
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
            fileType={fileManager.activeTab.fileType}
            onNew={handleNewTab}
            onOpen={fileManager.openFile}
            onSave={fileManager.saveFile}
            onSaveAs={fileManager.saveFileAs}
            onExportHtml={handleExportHtml}
            onExportPdf={handleExportPdf}
            onFormat={handleFormat}
            onSetWordTarget={handleSetWordTarget}
            onToggleSource={handleToggleSource}
            onToggleSidebar={() => setSidebarVisible((s) => !s)}
            onToggleFocus={handleToggleFocus}
            onToggleFileTree={() => setFileTreeVisible((s) => !s)}
            onToggleAutoSave={() => setAutoSaveEnabled((s) => !s)}
            onOpenRecent={handleOpenRecentFile}
            onFind={() => { setFindReplaceMode(false); setFindVisible(true); }}
            onReplace={() => { setFindReplaceMode(true); setFindVisible(true); }}
            onCopyPlainText={handleCopyPlainText}
            writingMode={writingMode}
            onToggleWritingMode={handleToggleWritingMode}
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
            onOpenAbout={() => setAboutDialogVisible(true)}
            onProGate={() => setProGateVisible(true)}
            onCheckUpdate={() => setUpdateDialogVisible(true)}
            alwaysOnTop={alwaysOnTop}
            onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
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
          <Sidebar visible={sidebarVisible && !focusMode} markdown={fileManager.content} onChange={fileManager.activeTab.fileType === "markdown" ? fileManager.setContent : undefined} />
          <div className="editor-wrapper" ref={editorWrapperRef}>
            <FindReplace
              visible={findVisible && !sourceMode}
              replaceMode={findReplaceMode}
              onClose={() => setFindVisible(false)}
            />
            {["json", "yaml", "javascript", "html", "css"].includes(fileManager.activeTab.fileType) ? (
              <CodeEditor
                key={fileManager.activeTabId}
                content={fileManager.content}
                fileType={fileManager.activeTab.fileType}
                onChange={handleContentChange}
              />
            ) : fileManager.activeTab.fileType === "text" ? (
              <SourceEditor key={fileManager.activeTabId} content={fileManager.content} onChange={handleContentChange} />
            ) : sourceMode ? (
              <SourceEditor key={fileManager.activeTabId} content={fileManager.content} onChange={handleContentChange} />
            ) : (
              <Editor
                key={fileManager.activeTabId}
                ref={editorRef}
                content={fileManager.content}
                fileVersion={fileManager.fileVersion}
                fontSize={fontSize}
                writingMode={writingMode && fileManager.activeTab.fileType === "markdown"}
                onChange={handleContentChange}
              />
            )}
          </div>
          <WritingPanel
            visible={writingMode && !focusMode && fileManager.activeTab.fileType === "markdown"}
            stats={writingStats}
            markdown={fileManager.content}
            onClose={() => setWritingMode(false)}
            onEditGoal={() => setWritingGoalDialogVisible(true)}
          />
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
            isTrial={license.isTrial}
            trialDaysLeft={license.trialDaysLeft}
            wordTarget={wordTarget}
            selectionCount={selectionCount}
          />
        )}
        <LicenseDialog
          visible={licenseDialogVisible}
          isPro={license.isPro}
          isTrial={license.isTrial}
          licenseKey={license.licenseKey}
          onActivate={license.activate}
          onDeactivate={license.deactivate}
          onClose={() => setLicenseDialogVisible(false)}
        />
        <AboutDialog
          visible={aboutDialogVisible}
          isPro={license.isPro}
          isTrial={license.isTrial}
          onClose={() => setAboutDialogVisible(false)}
        />
        <ProGate
          visible={proGateVisible}
          onClose={() => setProGateVisible(false)}
          onOpenLicense={() => setLicenseDialogVisible(true)}
        />
        <InputDialog
          visible={wordTargetDialogVisible}
          title={i18n.t("menu.wordTarget")}
          placeholder="500"
          defaultValue={wordTarget ? String(wordTarget) : ""}
          onConfirm={handleWordTargetConfirm}
          onCancel={() => setWordTargetDialogVisible(false)}
        />
        <InputDialog
          visible={writingGoalDialogVisible}
          title={i18n.t("writing.goalPrompt")}
          placeholder="500"
          defaultValue={String(writingStats.goal)}
          onConfirm={(val) => {
            const n = parseInt(val, 10);
            if (Number.isFinite(n) && n > 0) writingStats.setGoal(n);
            setWritingGoalDialogVisible(false);
          }}
          onCancel={() => setWritingGoalDialogVisible(false)}
        />
        <AlertDialog
          visible={trialWelcomeVisible}
          title={i18n.t("trial.welcomeTitle")}
          message={i18n.t("trial.welcome")}
          onClose={() => setTrialWelcomeVisible(false)}
        />
        <AlertDialog
          visible={whatsNewVisible}
          title={i18n.t("update.whatsNewTitle").replace("{version}", whatsNewVersion)}
          message={i18n.t("update.whatsNewMessage").replace("{version}", whatsNewVersion)}
          onClose={() => setWhatsNewVisible(false)}
        />
        <UpdateDialog
          open={updateDialogVisible}
          status={updater.status}
          progress={updater.progress}
          newVersion={updater.newVersion}
          releaseNotes={updater.releaseNotes}
          error={updater.error}
          onCheck={updater.checkForUpdate}
          onDownload={updater.downloadAndInstall}
          onRestart={updater.restartApp}
          onClose={() => setUpdateDialogVisible(false)}
        />
        <AlertDialog
          visible={trialExpiredVisible}
          title={i18n.t("license.upgradeTitle")}
          message={license.trialDaysLeft > 0 ? i18n.t("trial.expiringSoon").replace("{days}", String(license.trialDaysLeft)) : i18n.t("trial.expired")}
          actionLabel={i18n.t("trial.buyNow")}
          onAction={() => openExternal(CHECKOUT_URL)}
          onClose={() => setTrialExpiredVisible(false)}
        />
        {toast && <div className="app-toast" role="status">{toast}</div>}
      </div>
    </I18nCtx.Provider>
  );
}

export default App;
