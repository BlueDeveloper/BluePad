import { useEffect, useRef, useState } from "react";
import { useI18n, LANGUAGES } from "../i18n";
import type { Lang } from "../i18n";
import type { FileType } from "../hooks/useFileManager";

interface MenuBarProps {
  fileName: string;
  isModified: boolean;
  sourceMode: boolean;
  sidebarVisible: boolean;
  focusMode: boolean;
  fileTreeVisible: boolean;
  autoSaveEnabled: boolean;
  recentFiles: string[];
  fontSize: number;
  isPro: boolean;
  fileType: FileType;
  onNew: () => void;
  onOpen: () => Promise<void>;
  onSave: () => Promise<void>;
  onSaveAs: () => Promise<void>;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onFormat: () => void;
  onSetWordTarget: () => void;
  onToggleSource: () => void;
  onToggleSidebar: () => void;
  onToggleFocus: () => void;
  onToggleFileTree: () => void;
  onToggleAutoSave: () => void;
  onOpenRecent: (path: string) => void;
  onFind: () => void;
  onReplace: () => void;
  onFontIncrease: () => void;
  onFontDecrease: () => void;
  onFontReset: () => void;
  theme: string;
  themes: readonly { readonly id: string; readonly label: string }[];
  onThemeChange: (id: string) => void;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onOpenLicense: () => void;
  onOpenAbout: () => void;
  onProGate: () => void;
  onCheckUpdate: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  checked?: boolean;
  divider?: boolean;
  pro?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

export function MenuBar({
  fileName,
  isModified,
  sourceMode,
  sidebarVisible,
  focusMode,
  fileTreeVisible,
  autoSaveEnabled,
  recentFiles,
  fontSize,
  isPro,
  fileType,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onFormat,
  onSetWordTarget,
  onToggleSource,
  onToggleSidebar,
  onToggleFocus,
  onToggleFileTree,
  onToggleAutoSave,
  onOpenRecent,
  onFind,
  onReplace,
  onFontIncrease,
  onFontDecrease,
  onFontReset,
  theme,
  themes,
  onThemeChange,
  lang,
  onLangChange,
  onOpenLicense,
  onOpenAbout,
  onProGate,
  onCheckUpdate,
}: MenuBarProps) {
  const { t } = useI18n();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const extractName = (path: string) => {
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || path;
  };

  const proAction = (action: () => void) => {
    return isPro ? action : onProGate;
  };

  const menus: MenuDef[] = [
    {
      label: t("menu.file"),
      items: [
        { label: t("menu.newFile"), shortcut: "Ctrl+N", action: onNew },
        { label: t("menu.open"), shortcut: "Ctrl+O", action: onOpen },
        { label: t("menu.save"), shortcut: "Ctrl+S", action: onSave },
        { label: t("menu.saveAs"), shortcut: "Ctrl+Shift+S", action: onSaveAs },
        { label: "", action: () => {}, divider: true },
        ...(recentFiles.length > 0
          ? [
              ...recentFiles.slice(0, 5).map((f) => ({
                label: extractName(f),
                action: () => onOpenRecent(f),
              })),
              { label: "", action: () => {}, divider: true },
            ]
          : []),
        { label: t("menu.autoSave"), action: onToggleAutoSave, checked: autoSaveEnabled },
        { label: "", action: () => {}, divider: true },
        { label: t("menu.exportHtml"), action: proAction(onExportHtml), pro: !isPro },
        { label: t("menu.exportPdf"), action: onExportPdf },
      ],
    },
    {
      label: t("menu.edit"),
      items: [
        { label: t("menu.find"), shortcut: "Ctrl+F", action: onFind },
        { label: t("menu.replace"), shortcut: "Ctrl+H", action: onReplace },
        ...((fileType === "json" || fileType === "yaml") ? [
          { label: "", action: () => {}, divider: true },
          { label: t("menu.format"), shortcut: "Ctrl+Shift+F", action: onFormat },
        ] as MenuItem[] : []),
      ],
    },
    {
      label: t("menu.view"),
      items: [
        { label: t("menu.sourceMode"), shortcut: "Ctrl+/", action: onToggleSource, checked: sourceMode },
        { label: t("menu.outlineSidebar"), shortcut: "Ctrl+Shift+L", action: onToggleSidebar, checked: sidebarVisible },
        { label: t("menu.fileTree"), action: onToggleFileTree, checked: fileTreeVisible },
        { label: t("menu.focusMode"), shortcut: "F11", action: proAction(onToggleFocus), checked: focusMode, pro: !isPro },
        { label: "", action: () => {}, divider: true },
        { label: t("menu.wordTarget"), action: onSetWordTarget },
        { label: "", action: () => {}, divider: true },
        { label: `${t("menu.fontIncrease")} (${fontSize}px)`, shortcut: "Ctrl+=", action: onFontIncrease },
        { label: t("menu.fontDecrease"), shortcut: "Ctrl+-", action: onFontDecrease },
        { label: t("menu.fontReset"), shortcut: "Ctrl+0", action: onFontReset },
        { label: "", action: () => {}, divider: true },
        ...themes.map((th) => ({
          label: `${t("menu.theme")}: ${th.label}`,
          action: th.id === "classic" || isPro ? () => onThemeChange(th.id) : onProGate,
          checked: theme === th.id,
          pro: th.id !== "classic" && !isPro,
        })),
      ],
    },
    {
      label: t("menu.settings"),
      items: [
        ...LANGUAGES.map((l) => ({
          label: `${t("menu.language")}: ${l.label}`,
          action: () => onLangChange(l.id),
          checked: lang === l.id,
        })),
        { label: "", action: () => {}, divider: true },
        { label: t("menu.license"), action: onOpenLicense },
        { label: t("menu.support"), action: () => { import("@tauri-apps/plugin-shell").then(m => m.open("https://bluepad.work/support/")).catch(() => window.open("https://bluepad.work/support/", "_blank")); } },
        { label: t("menu.checkUpdate"), action: onCheckUpdate },
        { label: "", action: () => {}, divider: true },
        { label: t("menu.about"), action: onOpenAbout },
      ],
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); onNew(); }
      else if (e.ctrlKey && e.key === "o") { e.preventDefault(); onOpen(); }
      else if (e.ctrlKey && e.shiftKey && e.key === "S") { e.preventDefault(); onSaveAs(); }
      else if (e.ctrlKey && e.shiftKey && e.key === "F") { e.preventDefault(); onFormat(); }
      else if (e.ctrlKey && e.key === "s") { e.preventDefault(); onSave(); }
      else if (e.ctrlKey && e.key === "/") { e.preventDefault(); onToggleSource(); }
      else if (e.ctrlKey && e.shiftKey && e.key === "L") { e.preventDefault(); onToggleSidebar(); }
      else if (e.key === "F11") { e.preventDefault(); onToggleFocus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNew, onOpen, onSave, onSaveAs, onFormat, onToggleSource, onToggleSidebar, onToggleFocus]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="menubar" ref={menuRef}>
      <div className="menubar-menus">
        {menus.map((menu) => (
          <div key={menu.label} className="menu-wrapper">
            <button
              className={`menu-trigger ${openMenu === menu.label ? "active" : ""}`}
              onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <div className="menu-dropdown">
                {menu.items.map((item, i) =>
                  item.divider ? (
                    <div key={i} className="menu-divider" />
                  ) : (
                    <button
                      key={i}
                      className="menu-item"
                      onClick={() => {
                        item.action();
                        setOpenMenu(null);
                      }}
                    >
                      <span className="menu-item-check">{item.checked ? "✓" : ""}</span>
                      <span className="menu-item-label">{item.label}{item.pro && <span className="menu-pro-badge">PRO</span>}</span>
                      {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="menubar-title">
        {isModified ? `${fileName} — ${t("title.modified")}` : fileName}
      </div>
      <div className="menubar-toggles">
        <button
          className={`toggle-btn ${sourceMode ? "active" : ""}`}
          onClick={onToggleSource}
          title={t("tooltip.sourceMode")}
        >
          {"</>"}
        </button>
        <button
          className={`toggle-btn ${fileTreeVisible ? "active" : ""}`}
          onClick={onToggleFileTree}
          title={t("tooltip.fileTree")}
        >
          &#128193;
        </button>
        <button
          className={`toggle-btn ${sidebarVisible ? "active" : ""}`}
          onClick={onToggleSidebar}
          title={t("tooltip.outlineSidebar")}
        >
          &#9776;
        </button>
        <button
          className={`toggle-btn ${focusMode ? "active" : ""}`}
          onClick={() => (isPro ? onToggleFocus() : onProGate())}
          title={t("tooltip.focusMode")}
        >
          &#9974;
        </button>
      </div>
    </div>
  );
}
