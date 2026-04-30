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
}

export interface HeadingItem {
  level: number;
  text: string;
  id: string;
}
