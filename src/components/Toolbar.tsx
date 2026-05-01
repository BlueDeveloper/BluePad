import type { EditorHandle } from "../types";
import { useI18n } from "../i18n";

interface ToolbarProps {
  editorRef: React.RefObject<EditorHandle | null>;
  sourceMode: boolean;
}

export function Toolbar({ editorRef, sourceMode }: ToolbarProps) {
  const { t } = useI18n();
  if (sourceMode) return null;

  const call = (fn: (e: EditorHandle) => void) => {
    if (editorRef.current) fn(editorRef.current);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={() => call((e) => e.bold())} title={t("toolbar.bold")}>
          <b>B</b>
        </button>
        <button onClick={() => call((e) => e.italic())} title={t("toolbar.italic")}>
          <i>I</i>
        </button>
        <button onClick={() => call((e) => e.strikethrough())} title={t("toolbar.strikethrough")}>
          <s>S</s>
        </button>
        <button onClick={() => call((e) => e.inlineCode())} title={t("toolbar.inlineCode")}>
          <code>&lt;/&gt;</code>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => call((e) => e.heading(1))} title={t("toolbar.heading1")}>
          H1
        </button>
        <button onClick={() => call((e) => e.heading(2))} title={t("toolbar.heading2")}>
          H2
        </button>
        <button onClick={() => call((e) => e.heading(3))} title={t("toolbar.heading3")}>
          H3
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => call((e) => e.bulletList())} title={t("toolbar.bulletList")}>
          &#8226; List
        </button>
        <button onClick={() => call((e) => e.orderedList())} title={t("toolbar.orderedList")}>
          1. List
        </button>
        <button onClick={() => call((e) => e.blockquote())} title={t("toolbar.blockquote")}>
          &ldquo; Quote
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => call((e) => e.codeBlock())} title={t("toolbar.codeBlock")}>
          Code
        </button>
        <button onClick={() => call((e) => e.insertTable())} title={t("toolbar.table")}>
          Table
        </button>
        <button onClick={() => call((e) => e.horizontalRule())} title={t("toolbar.horizontalRule")}>
          &#8212;
        </button>
        <button onClick={() => call((e) => e.toggleLink())} title={t("toolbar.link")}>
          Link
        </button>
      </div>
    </div>
  );
}
