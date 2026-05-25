/**
 * 마크다운 문자열을 일반 텍스트로 변환 — 줄바꿈은 그대로 보존.
 * DOM 순회 방식(ProseMirror 단일 <p> 케이스)에서 줄바꿈 누락 문제를 회피.
 */
export function stripMarkdownToPlain(md: string): string {
  if (!md) return "";
  let out = md;

  // YAML front matter 제거
  out = out.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");

  // 코드 펜스: 내부 텍스트만 보존, 백틱 줄 제거
  out = out.replace(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```/g, "$1");

  // 이미지 ![alt](url) → 제거
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // 링크 [text](url) → text
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // 헤딩 # ~ ###### + 공백
  out = out.replace(/^#{1,6}\s+/gm, "");

  // bold/italic/strikethrough
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/__([^_]+)__/g, "$1");
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
  out = out.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1");
  out = out.replace(/~~([^~]+)~~/g, "$1");

  // 하이라이트 ==text==
  out = out.replace(/==([^=]+)==/g, "$1");

  // 인라인 코드 `text`
  out = out.replace(/`([^`\n]+)`/g, "$1");

  // blockquote: > 표시 제거 (들여쓰기 유지 안 함)
  out = out.replace(/^>\s?/gm, "");

  // 글머리 기호 / 체크리스트
  out = out.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/gm, "$1");
  out = out.replace(/^(\s*)[-*+]\s+/gm, "$1");

  // 번호 매기기
  out = out.replace(/^(\s*)\d+\.\s+/gm, "$1");

  // 수평선
  out = out.replace(/^(?:---+|\*\*\*+|___+)\s*$/gm, "");

  // 표 구분선
  out = out.replace(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/gm, "");

  // 표 행: | a | b | c | → a\tb\tc
  out = out.replace(/^\|(.+)\|\s*$/gm, (_m, content: string) =>
    content
      .split("|")
      .map((cell) => cell.trim())
      .join("\t")
  );

  // \[toc\] 디렉티브 제거
  out = out.replace(/^\[toc\]\s*$/gim, "");

  // KaTeX 블록 $$...$$ 제거 (인라인 $...$는 텍스트로 둠)
  out = out.replace(/\$\$[\s\S]*?\$\$/g, "");

  // HTML 태그 제거 (간단)
  out = out.replace(/<[^>]+>/g, "");

  // NBSP → 일반 공백
  out = out.replace(/ /g, " ");

  // 빈 줄 3개 이상 → 2개로 압축
  out = out.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
