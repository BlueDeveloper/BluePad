export interface EditorHandle {
  bold: () => void;
  italic: () => void;
  strikethrough: () => void;
  heading: (level: number) => void;
  bulletList: () => void;
  orderedList: () => void;
  blockquote: () => void;
  codeBlock: () => void;
  inlineCode: () => void;
  horizontalRule: () => void;
  insertTable: () => void;
  toggleLink: () => void;
  insertImage: () => void;
  getMarkdown: () => string;
  copyAsPlainText: () => Promise<boolean>;
}

export interface HeadingItem {
  level: number;
  text: string;
  id: string;
  /** 헤딩 라인의 0-based 인덱스 (드래그 재배치용) */
  lineStart: number;
}
