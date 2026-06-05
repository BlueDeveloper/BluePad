import { useRef, useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n";
import type { Tab, FileType } from "../hooks/useFileManager";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: (fileType: FileType) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}

// + 버튼 드롭다운에 노출할 파일 타입 목록 (확장자 함께 표기)
const NEW_FILE_TYPES: { type: FileType; label: string }[] = [
  { type: "markdown", label: "Markdown (.md)" },
  { type: "text", label: "Text (.txt)" },
  { type: "html", label: "HTML (.html)" },
  { type: "css", label: "CSS (.css)" },
  { type: "javascript", label: "JavaScript (.js)" },
  { type: "json", label: "JSON (.json)" },
  { type: "yaml", label: "YAML (.yaml)" },
];

export function TabBar({ tabs, activeTabId, onSwitch, onClose, onNew, onReorder }: TabBarProps) {
  const { t } = useI18n();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const newBtnRef = useRef<HTMLButtonElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIdx: number) => {
      e.preventDefault();
      const fromIdx = dragIdx ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!isNaN(fromIdx) && fromIdx !== toIdx) {
        onReorder(fromIdx, toIdx);
      }
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        onClose(tabId);
      }
    },
    [onClose]
  );

  // + 버튼: 파일 타입 드롭다운 토글. 메뉴는 탭바 overflow에 잘리지 않도록 fixed 위치.
  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos((prev) => {
      if (prev) return null;
      const r = newBtnRef.current?.getBoundingClientRect();
      return r ? { x: r.left, y: r.bottom + 2 } : null;
    });
  }, []);

  // 외부 클릭 / Esc 로 메뉴 닫기
  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuPos(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuPos]);

  return (
    <div className="tabbar">
      <div className="tabbar-tabs" ref={tabsRef}>
        {tabs.map((tab, idx) => (
          <div
            key={tab.id}
            className={`tabbar-tab ${tab.id === activeTabId ? "active" : ""} ${dragOverIdx === idx ? "drag-over" : ""}`}
            onClick={() => onSwitch(tab.id)}
            onMouseDown={(e) => handleMiddleClick(e, tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
          >
            <span className="tabbar-tab-name">
              {tab.isModified && <span className="tabbar-tab-dot" />}
              {tab.fileName}
            </span>
            <button
              className="tabbar-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              title={t("tab.close")}
            >
              ×
            </button>
          </div>
        ))}
        {/* + 버튼 — 마지막 탭 바로 옆 */}
        <button
          ref={newBtnRef}
          className={`tabbar-new ${menuPos ? "open" : ""}`}
          onClick={toggleMenu}
          title={t("tab.newTab")}
          aria-haspopup="menu"
          aria-expanded={menuPos ? true : false}
        >
          +
        </button>
      </div>

      {menuPos && (
        <div
          className="tabbar-new-menu"
          style={{ position: "fixed", left: menuPos.x, top: menuPos.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {NEW_FILE_TYPES.map((ft) => (
            <button
              key={ft.type}
              className="tabbar-new-menu-item"
              role="menuitem"
              onClick={() => {
                onNew(ft.type);
                setMenuPos(null);
              }}
            >
              {ft.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
