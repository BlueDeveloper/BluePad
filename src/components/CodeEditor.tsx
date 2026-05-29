import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { classHighlighter } from "@lezer/highlight";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { searchKeymap, highlightSelectionMatches, openSearchPanel, closeSearchPanel } from "@codemirror/search";
import * as jsYaml from "js-yaml";
import type { FileType } from "../hooks/useFileManager";

export interface CodeEditorHandle {
  openSearch: () => void;
  closeSearch: () => void;
}

interface CodeEditorProps {
  content: string;
  fileType: FileType;
  onChange: (value: string) => void;
}

const theme = EditorView.theme({
  "&": {
    flex: "1",
    height: "100%",
    fontSize: "14px",
    backgroundColor: "var(--bg)",
    color: "var(--text)",
  },
  ".cm-content": {
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace",
    lineHeight: "1.7",
    padding: "16px 0",
    caretColor: "var(--text)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-muted, #999)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--bg-hover, rgba(0,0,0,0.05))",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--bg-hover, rgba(0,0,0,0.03))",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(21, 93, 252, 0.15)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(21, 93, 252, 0.25)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text)",
  },
  ".cm-foldGutter .cm-gutterElement": {
    cursor: "pointer",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  // ── 검색/바꾸기 패널 ──
  ".cm-panels": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text)",
    borderTop: "1px solid var(--border)",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--border)",
  },
  ".cm-panel.cm-search": {
    padding: "10px 12px",
    fontFamily: "'Pretendard Variable', -apple-system, 'Segoe UI', sans-serif",
    fontSize: "13px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
  },
  ".cm-panel.cm-search input, .cm-panel.cm-search input[type=text]": {
    backgroundColor: "var(--bg)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "7px",
    padding: "5px 10px",
    fontSize: "13px",
    fontFamily: "inherit",
    outline: "none",
    minWidth: "180px",
  },
  ".cm-panel.cm-search input:focus": {
    borderColor: "#155dfc",
  },
  ".cm-panel.cm-search button, .cm-panel.cm-search .cm-button": {
    backgroundColor: "var(--bg)",
    backgroundImage: "none",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "7px",
    padding: "5px 11px",
    fontSize: "13px",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background-color .12s, border-color .12s",
  },
  ".cm-panel.cm-search button:hover, .cm-panel.cm-search .cm-button:hover": {
    backgroundColor: "var(--bg-hover, rgba(127,127,127,0.12))",
    borderColor: "#155dfc",
  },
  ".cm-panel.cm-search label": {
    fontSize: "12.5px",
    color: "var(--text-muted, #888)",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
  },
  ".cm-panel.cm-search label input[type=checkbox]": {
    minWidth: "auto",
    accentColor: "#155dfc",
    cursor: "pointer",
  },
  ".cm-panel.cm-search [name=close]": {
    position: "absolute",
    top: "6px",
    right: "10px",
    padding: "0",
    width: "22px",
    height: "22px",
    lineHeight: "20px",
    fontSize: "18px",
    border: "none",
    background: "none",
    color: "var(--text-muted, #888)",
    borderRadius: "5px",
  },
  ".cm-panel.cm-search [name=close]:hover": {
    backgroundColor: "var(--bg-hover, rgba(127,127,127,0.15))",
    color: "var(--text)",
    borderColor: "transparent",
  },
});

function getLanguageExtension(fileType: FileType) {
  switch (fileType) {
    case "json": return json();
    case "yaml": return yaml();
    case "javascript": return javascript({ jsx: true, typescript: true });
    case "html": return html();
    case "css": return css();
    default: return [];
  }
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ content, fileType, onChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    openSearch: () => {
      if (viewRef.current) {
        viewRef.current.focus();
        openSearchPanel(viewRef.current);
      }
    },
    closeSearch: () => {
      if (viewRef.current) closeSearchPanel(viewRef.current);
    },
  }));

  // Prevent re-creating editor when only onChange changes
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        foldGutter(),
        highlightSelectionMatches(),
        history(),
        syntaxHighlighting(classHighlighter),
        getLanguageExtension(fileType),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            isInternalUpdate.current = true;
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileType]);

  // Sync external content changes (e.g. file reload) without recreating editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} className="code-editor-container" />;
});
CodeEditor.displayName = "CodeEditor";

export function formatCode(content: string, fileType: FileType): { formatted: string; error?: string } {
  if (fileType === "json") {
    try {
      const parsed = JSON.parse(content);
      return { formatted: JSON.stringify(parsed, null, 2) };
    } catch (e) {
      return { formatted: content, error: String(e) };
    }
  }
  if (fileType === "yaml") {
    try {
      const parsed = jsYaml.load(content);
      return { formatted: jsYaml.dump(parsed, { indent: 2, lineWidth: 120, noRefs: true }) };
    } catch (e) {
      return { formatted: content, error: String(e) };
    }
  }
  return { formatted: content };
}
