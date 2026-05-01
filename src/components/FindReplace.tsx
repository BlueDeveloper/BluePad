import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "../i18n";

interface FindReplaceProps {
  visible: boolean;
  replaceMode: boolean;
  onClose: () => void;
}

export function FindReplace({ visible, replaceMode, onClose }: FindReplaceProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [showReplace, setShowReplace] = useState(replaceMode);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowReplace(replaceMode);
  }, [replaceMode]);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [visible]);

  const clearHighlights = useCallback(() => {
    const editor = document.querySelector(".editor-content .ProseMirror");
    if (!editor) return;
    const marks = editor.querySelectorAll("mark[data-find]");
    marks.forEach((m) => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent || ""), m);
        parent.normalize();
      }
    });
  }, []);

  const highlight = useCallback(
    (searchStr: string) => {
      clearHighlights();
      if (!searchStr) {
        setMatchCount(0);
        setCurrentMatch(0);
        return;
      }

      const editor = document.querySelector(".editor-content .ProseMirror");
      if (!editor) return;

      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      const textNodes: Text[] = [];
      let node;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      let count = 0;
      const lowerSearch = searchStr.toLowerCase();

      for (const textNode of textNodes) {
        const text = textNode.textContent || "";
        const lowerText = text.toLowerCase();
        let idx = lowerText.indexOf(lowerSearch);
        if (idx === -1) continue;

        const frag = document.createDocumentFragment();
        let lastIdx = 0;

        while (idx !== -1) {
          count++;
          if (lastIdx < idx) {
            frag.appendChild(document.createTextNode(text.substring(lastIdx, idx)));
          }
          const mark = document.createElement("mark");
          mark.setAttribute("data-find", String(count));
          mark.style.background = count === 1 ? "#ff9632" : "#ffff00";
          mark.style.color = "#333";
          mark.style.borderRadius = "2px";
          mark.textContent = text.substring(idx, idx + searchStr.length);
          frag.appendChild(mark);
          lastIdx = idx + searchStr.length;
          idx = lowerText.indexOf(lowerSearch, lastIdx);
        }

        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.substring(lastIdx)));
        }

        textNode.parentNode?.replaceChild(frag, textNode);
      }

      setMatchCount(count);
      setCurrentMatch(count > 0 ? 1 : 0);

      if (count > 0) {
        const first = editor.querySelector('mark[data-find="1"]');
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [clearHighlights]
  );

  const jumpTo = useCallback(
    (index: number) => {
      const editor = document.querySelector(".editor-content .ProseMirror");
      if (!editor || matchCount === 0) return;

      const marks = editor.querySelectorAll("mark[data-find]");
      marks.forEach((m) => {
        (m as HTMLElement).style.background = "#ffff00";
      });

      const target = editor.querySelector(`mark[data-find="${index}"]`);
      if (target) {
        (target as HTMLElement).style.background = "#ff9632";
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [matchCount]
  );

  const findNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = currentMatch >= matchCount ? 1 : currentMatch + 1;
    setCurrentMatch(next);
    jumpTo(next);
  }, [currentMatch, matchCount, jumpTo]);

  const findPrev = useCallback(() => {
    if (matchCount === 0) return;
    const prev = currentMatch <= 1 ? matchCount : currentMatch - 1;
    setCurrentMatch(prev);
    jumpTo(prev);
  }, [currentMatch, matchCount, jumpTo]);

  const replaceOne = useCallback(() => {
    const editor = document.querySelector(".editor-content .ProseMirror");
    if (!editor || matchCount === 0) return;
    const mark = editor.querySelector(`mark[data-find="${currentMatch}"]`);
    if (mark) {
      mark.textContent = replace;
      mark.removeAttribute("data-find");
      (mark as HTMLElement).style.background = "transparent";
    }
    highlight(query);
  }, [currentMatch, matchCount, replace, query, highlight]);

  const replaceAll = useCallback(() => {
    const editor = document.querySelector(".editor-content .ProseMirror");
    if (!editor || matchCount === 0) return;
    const marks = editor.querySelectorAll("mark[data-find]");
    marks.forEach((m) => {
      const text = document.createTextNode(replace);
      m.parentNode?.replaceChild(text, m);
    });
    setMatchCount(0);
    setCurrentMatch(0);
  }, [matchCount, replace]);

  useEffect(() => {
    highlight(query);
    return () => clearHighlights();
  }, [query, highlight, clearHighlights]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === "Escape") {
        clearHighlights();
        onClose();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        findNext();
      } else if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        findPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, findNext, findPrev, onClose, clearHighlights]);

  if (!visible) return null;

  return (
    <div className="find-replace">
      <div className="find-row">
        <input
          ref={inputRef}
          className="find-input"
          type="text"
          placeholder={t("find.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="find-count">
          {matchCount > 0 ? `${currentMatch}/${matchCount}` : t("find.noResults")}
        </span>
        <button className="find-btn" onClick={findPrev} title={t("find.previous")}>&#9650;</button>
        <button className="find-btn" onClick={findNext} title={t("find.next")}>&#9660;</button>
        <button
          className="find-btn"
          onClick={() => setShowReplace((s) => !s)}
          title={t("find.toggleReplace")}
        >
          {showReplace ? "▾" : "▸"}
        </button>
        <button className="find-btn find-close" onClick={() => { clearHighlights(); onClose(); }}>✕</button>
      </div>
      {showReplace && (
        <div className="find-row">
          <input
            className="find-input"
            type="text"
            placeholder={t("find.replacePlaceholder")}
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
          />
          <button className="find-btn find-action" onClick={replaceOne}>{t("find.replace")}</button>
          <button className="find-btn find-action" onClick={replaceAll}>{t("find.replaceAll")}</button>
        </div>
      )}
    </div>
  );
}
