interface StatusBarProps {
  chars: number;
  words: number;
  lines: number;
  filePath: string | null;
  sourceMode: boolean;
  autoSave: boolean;
  fontSize: number;
}

export function StatusBar({ chars, words, lines, filePath, sourceMode, autoSave, fontSize }: StatusBarProps) {
  return (
    <div className="statusbar">
      <span className="statusbar-item statusbar-path">
        {filePath ?? "새 파일"}
      </span>
      <div className="statusbar-right">
        {sourceMode && <span className="statusbar-badge">소스</span>}
        {autoSave && <span className="statusbar-badge statusbar-badge-auto">자동저장</span>}
        <span className="statusbar-item">{fontSize}px</span>
        <span className="statusbar-item">{lines} 줄</span>
        <span className="statusbar-item">{words} 단어</span>
        <span className="statusbar-item">{chars} 자</span>
      </div>
    </div>
  );
}
