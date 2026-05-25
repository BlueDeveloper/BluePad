import { useRef, useEffect } from "react";
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
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import * as jsYaml from "js-yaml";
import type { FileType } from "../hooks/useFileManager";

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

export function CodeEditor({ content, fileType, onChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
}

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
