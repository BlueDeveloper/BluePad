# Work Log 2026-06-29 — BluePad 영문 블로그 자동발행

## 작업 (월요일 — [B] 발행일)
- 영문 롱테일 신규 1편 생성: `landing/en/blog/markdown-math-equations-katex.html`
  - Title: How to Write Math Equations in Markdown with KaTeX (Beginner's Guide)
  - 니치: KaTeX/LaTeX math in Markdown (inline `$...$` / block `$$...$$`), 기존 Mermaid 글과 구분(다이어그램 ≠ 수식).
  - 템플릿: `markdown-diagrams-with-mermaid.html` 복사 → head(GA4 G-3PRY6YKV05·Clarity wkokfmayny·naver 메타·스타일) 보존, title·desc·canonical·OG·BlogPosting·본문·CTA 교체, hreflang은 en + x-default 자기참조만(ko/ja 없음).
  - 본문: H2 4개·표 1(LaTeX 명령 치트시트)·FAQ 3·내부링크 3(markdown-editor-for-developers / markdown-writing-tips / markdown-diagrams-with-mermaid) + CTA(/en/download/).
- `landing/en/blog/index.html`: 최상단 카드 추가(2026-06-29).
- `landing/sitemap.xml`: `/en/blog/markdown-math-equations-katex` URL 추가(lastmod 2026-06-29, priority 0.6).

## 사실 가드 (CLAUDE.md §11)
- KaTeX 설명은 일반·검증 가능한 사실로 한정(오픈소스·Khan Academy 기원·LaTeX의 실용적 부분집합·빠른 렌더). "모든 LaTeX 지원" 식 과장 회피 — FAQ에서 "대부분 지원, 일부 niche 미포함"으로 정확히 기술.
- BluePad의 KaTeX 지원은 CLAUDE.md(Mermaid/KaTeX Free) 근거.

## 협조요청 (code)
- `docs/work-log/협조요청-code.md`에 [열림] append: landing 변경분 git push(Pages 자동배포) 요청.
- 미확인 `↩ cowork:` 항목: 6/28 `083ce47`의 "다음 일일 색인요청 때 클린URL(.html 없이)로 best-markdown-editors-2026 색인 재요청하면 성공" — cowork(색인 세션) 후속 진행 대상.

## 비고
- 자동화 샌드박스(파일쓰기 전용) — git/외부망 불가, git 명령 미실행. 배포는 code 3h cron이 picking up.
