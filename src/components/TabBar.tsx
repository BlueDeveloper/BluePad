import { useRef, useState, useCallback } from "react";
import { useI18n } from "../i18n";
import type { Tab } from "../hooks/useFileManager";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
}

export function TabBar({ tabs, activeTabId, onSwitch, onClose, onNew, onReorder }: TabBarProps) {
  const { t } = useI18n();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

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
      </div>
      <button className="tabbar-new" onClick={onNew} title={t("tab.newTab")}>
        +
      </button>
    </div>
  );
}
