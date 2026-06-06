import { useRef, useEffect } from "react";

interface SourceEditorProps {
  content: string;
  onChange: (value: string) => void;
}

export function SourceEditor({ content, onChange }: SourceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // IME(한글/일본어 등) 조합 진행 여부. 조합 중에는 부모 상태로 올리지 않아
  // controlled 재할당으로 조합이 깨지는 "한 박자 늦게 입력" 현상을 막는다.
  const composingRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // 외부(파일 로드/포맷/탭 전환)에서 content가 바뀌면 textarea에 반영.
  // textarea는 uncontrolled(defaultValue)라 직접 동기화하며, IME 조합 중에는 건드리지 않는다.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || composingRef.current) return;
    if (ta.value !== content) ta.value = content;
  }, [content]);

  const emit = () => {
    const ta = textareaRef.current;
    if (ta) onChange(ta.value);
  };

  const handleChange = () => {
    // 조합 중에는 emit 보류 → 조합 완료(compositionend) 시 최종값만 부모로 전달.
    if (composingRef.current) return;
    emit();
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    emit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + "  " + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
      onChange(ta.value);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="source-editor"
      defaultValue={content}
      onChange={handleChange}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      spellCheck={false}
    />
  );
}
