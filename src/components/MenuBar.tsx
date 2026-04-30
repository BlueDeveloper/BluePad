import { useEffect, useRef, useState } from "react";

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
  onNew: () => void;
  onOpen: () => Promise<void>;
  onSave: () => Promise<void>;
  onSaveAs: () => Promise<void>;
  onExportHtml: () => void;
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
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  checked?: boolean;
  divider?: boolean;
  submenu?: MenuItem[];
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
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportHtml,
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
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const extractName = (path: string) => {
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || path;
  };

  const menus: MenuDef[] = [
    {
      label: "파일",
      items: [
        { label: "새 파일", shortcut: "Ctrl+N", action: onNew },
        { label: "열기", shortcut: "Ctrl+O", action: onOpen },
        { label: "저장", shortcut: "Ctrl+S", action: onSave },
        { label: "다른 이름으로 저장", shortcut: "Ctrl+Shift+S", action: onSaveAs },
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
        { label: "자동 저장", action: onToggleAutoSave, checked: autoSaveEnabled },
        { label: "", action: () => {}, divider: true },
        { label: "HTML로 내보내기", action: onExportHtml },
      ],
    },
    {
      label: "편집",
      items: [
        { label: "찾기", shortcut: "Ctrl+F", action: onFind },
        { label: "바꾸기", shortcut: "Ctrl+H", action: onReplace },
      ],
    },
    {
      label: "보기",
      items: [
        { label: "소스 모드", shortcut: "Ctrl+/", action: onToggleSource, checked: sourceMode },
        { label: "개요 사이드바", shortcut: "Ctrl+Shift+L", action: onToggleSidebar, checked: sidebarVisible },
        { label: "파일 트리", action: onToggleFileTree, checked: fileTreeVisible },
        { label: "집중 모드", shortcut: "F11", action: onToggleFocus, checked: focusMode },
        { label: "", action: () => {}, divider: true },
        { label: `글꼴 크기 키우기 (${fontSize}px)`, shortcut: "Ctrl+=", action: onFontIncrease },
        { label: "글꼴 크기 줄이기", shortcut: "Ctrl+-", action: onFontDecrease },
        { label: "글꼴 크기 초기화", shortcut: "Ctrl+0", action: onFontReset },
        { label: "", action: () => {}, divider: true },
        ...themes.map((t) => ({
          label: `테마: ${t.label}`,
          action: () => onThemeChange(t.id),
          checked: theme === t.id,
        })),
      ],
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); onNew(); }
      else if (e.ctrlKey && e.key === "o") { e.preventDefault(); onOpen(); }
      else if (e.ctrlKey && e.shiftKey && e.key === "S") { e.preventDefault(); onSaveAs(); }
      else if (e.ctrlKey && e.key === "s") { e.preventDefault(); onSave(); }
      else if (e.ctrlKey && e.key === "/") { e.preventDefault(); onToggleSource(); }
      else if (e.ctrlKey && e.shiftKey && e.key === "L") { e.preventDefault(); onToggleSidebar(); }
      else if (e.key === "F11") { e.preventDefault(); onToggleFocus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNew, onOpen, onSave, onSaveAs, onToggleSource, onToggleSidebar, onToggleFocus]);

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
                      <span className="menu-item-label">{item.label}</span>
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
        {isModified ? `${fileName} — 수정됨` : fileName}
      </div>
      <div className="menubar-toggles">
        <button
          className={`toggle-btn ${sourceMode ? "active" : ""}`}
          onClick={onToggleSource}
          title="소스 모드 (Ctrl+/)"
        >
          {"</>"}
        </button>
        <button
          className={`toggle-btn ${fileTreeVisible ? "active" : ""}`}
          onClick={onToggleFileTree}
          title="파일 트리"
        >
          &#128193;
        </button>
        <button
          className={`toggle-btn ${sidebarVisible ? "active" : ""}`}
          onClick={onToggleSidebar}
          title="개요 사이드바 (Ctrl+Shift+L)"
        >
          &#9776;
        </button>
        <button
          className={`toggle-btn ${focusMode ? "active" : ""}`}
          onClick={onToggleFocus}
          title="집중 모드 (F11)"
        >
          &#9974;
        </button>
      </div>
    </div>
  );
}
