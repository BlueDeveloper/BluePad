import type { EditorHandle } from "../types";

interface ToolbarProps {
  editorRef: React.RefObject<EditorHandle | null>;
  sourceMode: boolean;
}

export function Toolbar({ editorRef, sourceMode }: ToolbarProps) {
  if (sourceMode) return null;

  const call = (fn: (e: EditorHandle) => void) => {
    if (editorRef.current) fn(editorRef.current);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button onClick={() => call((e) => e.bold())} title="굵게 (Ctrl+B)">
          <b>B</b>
        </button>
        <button onClick={() => call((e) => e.italic())} title="기울임 (Ctrl+I)">
          <i>I</i>
        </button>
        <button onClick={() => call((e) => e.strikethrough())} title="취소선">
          <s>S</s>
        </button>
        <button onClick={() => call((e) => e.inlineCode())} title="인라인 코드">
          <code>&lt;/&gt;</code>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => call((e) => e.heading(1))} title="제목 1">
          H1
        </button>
        <button onClick={() => call((e) => e.heading(2))} title="제목 2">
          H2
        </button>
        <button onClick={() => call((e) => e.heading(3))} title="제목 3">
          H3
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => call((e) => e.bulletList())} title="글머리 기호">
          &#8226; List
        </button>
        <button onClick={() => call((e) => e.orderedList())} title="번호 매기기">
          1. List
        </button>
        <button onClick={() => call((e) => e.blockquote())} title="인용문">
          &ldquo; Quote
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={() => call((e) => e.codeBlock())} title="코드 블록">
          Code
        </button>
        <button onClick={() => call((e) => e.insertTable())} title="표 삽입">
          Table
        </button>
        <button onClick={() => call((e) => e.horizontalRule())} title="수평선">
          &#8212;
        </button>
        <button onClick={() => call((e) => e.toggleLink())} title="링크">
          Link
        </button>
      </div>
    </div>
  );
}
