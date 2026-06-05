import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { Editor as MilkdownEditor, rootCtx, defaultValueCtx } from "@milkdown/kit/core";
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInBlockquoteCommand, createCodeBlockCommand, insertHrCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInHeadingCommand, toggleInlineCodeCommand, toggleLinkCommand, insertImageCommand } from "@milkdown/kit/preset/commonmark";
import { gfm, toggleStrikethroughCommand, insertTableCommand } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { indent } from "@milkdown/kit/plugin/indent";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { listItemBlockComponent } from "@milkdown/components/list-item-block";
import { math } from "@milkdown/plugin-math";
import { prism, prismConfig } from "@milkdown/plugin-prism";
import { refractor } from "refractor";
import "katex/dist/katex.min.css";
import type { EditorHandle } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CmdPlugin = { run?: (payload?: any) => boolean };

// 마크다운에서 마크업만 제거하고 줄바꿈은 유지 (인라인 헬퍼로 모듈 import 의존성 제거)
function stripMd(md: string): string {
  if (!md) return "";
  let o = md;
  o = o.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");
  o = o.replace(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```/g, "$1");
  o = o.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  o = o.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  o = o.replace(/^#{1,6}\s+/gm, "");
  o = o.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  o = o.replace(/__([^_\n]+)__/g, "$1");
  o = o.replace(/\*([^*\n]+)\*/g, "$1");
  o = o.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1$2");
  o = o.replace(/~~([^~\n]+)~~/g, "$1");
  o = o.replace(/==([^=\n]+)==/g, "$1");
  o = o.replace(/`([^`\n]+)`/g, "$1");
  o = o.replace(/^>\s?/gm, "");
  o = o.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/gm, "$1");
  o = o.replace(/^(\s*)[-*+]\s+/gm, "$1");
  o = o.replace(/^(\s*)\d+\.\s+/gm, "$1");
  o = o.replace(/^(?:---+|\*\*\*+|___+)\s*$/gm, "");
  o = o.replace(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/gm, "");
  o = o.replace(/^\|(.+)\|\s*$/gm, (_m, c) => String(c).split("|").map((x: string) => x.trim()).join("\t"));
  o = o.replace(/^\[toc\]\s*$/gim, "");
  o = o.replace(/\$\$[\s\S]*?\$\$/g, "");
  o = o.replace(/<[^>]+>/g, "");
  o = o.replace(/ /g, " ");
  o = o.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return o.trim();
}

interface EditorProps {
  content: string;
  fileVersion: number;
  fontSize: number;
  onChange: (markdown: string) => void;
  writingMode?: boolean;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(
  ({ content, fileVersion, fontSize, onChange, writingMode = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const milkdownRef = useRef<MilkdownEditor | null>(null);
    const contentRef = useRef(content);
    const writingModeRef = useRef(writingMode);

    contentRef.current = content;
    writingModeRef.current = writingMode;

    // 맞춤법 빨간 줄(spellcheck)은 작가 모드일 때만. 평상시 마크다운 편집엔 표시하지 않는다.
    const applySpellcheck = useCallback(() => {
      const pm = editorRef.current?.querySelector(".ProseMirror") as HTMLElement | null;
      if (pm) pm.setAttribute("spellcheck", writingModeRef.current ? "true" : "false");
    }, []);

    const run = (cmd: CmdPlugin, payload?: unknown) => {
      cmd.run?.(payload);
    };

    useImperativeHandle(ref, () => ({
      bold: () => run(toggleStrongCommand as CmdPlugin),
      italic: () => run(toggleEmphasisCommand as CmdPlugin),
      strikethrough: () => run(toggleStrikethroughCommand as CmdPlugin),
      heading: (level: number) => run(wrapInHeadingCommand as CmdPlugin, level),
      bulletList: () => run(wrapInBulletListCommand as CmdPlugin),
      orderedList: () => run(wrapInOrderedListCommand as CmdPlugin),
      blockquote: () => run(wrapInBlockquoteCommand as CmdPlugin),
      codeBlock: () => run(createCodeBlockCommand as CmdPlugin),
      inlineCode: () => run(toggleInlineCodeCommand as CmdPlugin),
      horizontalRule: () => run(insertHrCommand as CmdPlugin),
      insertTable: () => run(insertTableCommand as CmdPlugin),
      toggleLink: () => run(toggleLinkCommand as CmdPlugin, { href: "" }),
      insertImage: () => run(insertImageCommand as CmdPlugin, { src: "", alt: "" }),
      getMarkdown: () => contentRef.current,
      copyAsPlainText: async () => {
        try {
          const sel = window.getSelection()?.toString() ?? "";
          let text = sel;
          if (!text) {
            try {
              text = stripMd(contentRef.current);
            } catch {
              text = contentRef.current || "";
            }
          }
          text = text.replace(/ /g, " ").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
          if (!text) text = contentRef.current || "";
          if (!text) return false;
          const isWindows = /Win/i.test(navigator.userAgent || "");
          const finalText = isWindows ? text.replace(/\n/g, "\r\n") : text;
          await navigator.clipboard.writeText(finalText);
          return true;
        } catch {
          return false;
        }
      },
    }));

    // Front Matter rendering
    const renderFrontMatter = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.querySelectorAll(".frontmatter-block").forEach((b) => b.remove());
      const fm = contentRef.current.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) return;
      const block = document.createElement("div");
      block.className = "frontmatter-block";
      block.setAttribute("contenteditable", "false");
      const title = document.createElement("div");
      title.className = "frontmatter-title";
      title.textContent = "Front Matter";
      block.appendChild(title);
      const pre = document.createElement("pre");
      pre.className = "frontmatter-content";
      pre.textContent = fm[1];
      block.appendChild(pre);
      const pm = el.querySelector(".ProseMirror");
      if (pm && pm.firstChild) pm.insertBefore(block, pm.firstChild);
    }, []);

    // TOC rendering ([toc] directive)
    const renderTOC = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      el.querySelectorAll(".toc-generated").forEach((b) => b.remove());
      const paragraphs = el.querySelectorAll(".ProseMirror p");
      for (const p of paragraphs) {
        if (p.textContent?.trim().toLowerCase() !== "[toc]") continue;
        const headings = el.querySelectorAll(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6");
        if (headings.length === 0) continue;
        const toc = document.createElement("div");
        toc.className = "toc-generated";
        toc.setAttribute("contenteditable", "false");
        const tocTitle = document.createElement("div");
        tocTitle.className = "toc-title";
        tocTitle.textContent = "Table of Contents";
        toc.appendChild(tocTitle);
        const list = document.createElement("ul");
        list.className = "toc-list";
        for (const h of headings) {
          const level = parseInt(h.tagName[1]);
          const li = document.createElement("li");
          li.className = `toc-item toc-level-${level}`;
          const a = document.createElement("a");
          a.textContent = h.textContent || "";
          a.href = "#";
          a.onclick = (e: Event) => { e.preventDefault(); h.scrollIntoView({ behavior: "smooth", block: "start" }); };
          li.appendChild(a);
          list.appendChild(li);
        }
        toc.appendChild(list);
        (p as HTMLElement).style.display = "none";
        p.insertAdjacentElement("afterend", toc);
      }
    }, []);

    // Post-render enhancements
    const postRender = useCallback(async () => {
      await renderMermaid();
      renderFrontMatter();
      renderTOC();
      applySpellcheck();
    }, []);

    // Mermaid rendering
    const renderMermaid = useCallback(async () => {
      const el = editorRef.current;
      if (!el) return;
      const codeBlocks = el.querySelectorAll("pre > code");
      for (const block of codeBlocks) {
        const pre = block.parentElement;
        if (!pre) continue;
        const lang = block.className.match(/language-mermaid/);
        if (!lang) continue;
        if (pre.querySelector(".mermaid-rendered")) continue;

        const code = block.textContent || "";
        try {
          const mermaid = (await import("mermaid")).default;
          mermaid.initialize({ startOnLoad: false, theme: "default" });
          const { svg } = await mermaid.render("mermaid-" + Math.random().toString(36).slice(2), code);
          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-rendered";
          wrapper.innerHTML = svg;
          wrapper.style.textAlign = "center";
          wrapper.style.margin = "8px 0";
          pre.style.display = "none";
          pre.insertAdjacentElement("afterend", wrapper);
        } catch {
          // Invalid mermaid, show raw
        }
      }
    }, []);

    useEffect(() => {
      if (!editorRef.current) return;
      const el = editorRef.current;

      milkdownRef.current?.destroy();
      milkdownRef.current = null;
      el.innerHTML = "";

      // Milkdown이 markdown → ProseMirror → markdown 라운드트립 시 미세 차이(공백/줄바꿈)
      // 발생 → 초기 markdownUpdated 호출은 사용자 입력이 아니므로 skip해야 isModified가
      // 잘못 true 되지 않음. fileVersion 변경(파일 재로드/탭 전환)마다 플래그 초기화.
      let initialMarkdownUpdate = true;
      MilkdownEditor.make()
        .config((ctx) => {
          ctx.set(rootCtx, el);
          ctx.set(defaultValueCtx, contentRef.current);
          ctx.set(prismConfig.key, { configureRefractor: () => refractor });
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            contentRef.current = markdown;
            if (initialMarkdownUpdate) {
              initialMarkdownUpdate = false;
              setTimeout(postRender, 100);
              return;
            }
            onChange(markdown);
            setTimeout(postRender, 100);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(listItemBlockComponent)
        .use(math)
        .use(prism)
        .use(history)
        .use(listener)
        .use(clipboard)
        .use(indent)
        .use(trailing)
        .create()
        .then((editor) => {
          milkdownRef.current = editor;
          setTimeout(postRender, 200);
        });

      return () => {
        milkdownRef.current?.destroy();
        milkdownRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileVersion]);

    // Handle image paste
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;

      const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
          if (item.type.startsWith("image/")) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (!blob) return;

            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              run(insertImageCommand as CmdPlugin, { src: dataUrl, alt: "pasted-image" });
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      };

      const handleDrop = async (e: DragEvent) => {
        const files = e.dataTransfer?.files;
        if (!files) return;

        for (const file of files) {
          if (file.type.startsWith("image/")) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              run(insertImageCommand as CmdPlugin, { src: dataUrl, alt: file.name });
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      };

      el.addEventListener("paste", handlePaste);
      el.addEventListener("drop", handleDrop);
      return () => {
        el.removeEventListener("paste", handlePaste);
        el.removeEventListener("drop", handleDrop);
      };
    }, [fileVersion]);

    // 하이퍼링크 Ctrl/Meta + 클릭 시 외부 브라우저로 열기 (WYSIWYG에서 링크 활성화)
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      const handler = (e: MouseEvent) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const target = e.target as HTMLElement | null;
        const a = target?.closest("a") as HTMLAnchorElement | null;
        if (!a) return;
        const href = a.getAttribute("href");
        if (!href) return;
        // 외부 링크만 (mailto/tel/내부 앵커 제외)
        if (/^(https?:|mailto:|tel:)/i.test(href)) {
          e.preventDefault();
          e.stopPropagation();
          import("@tauri-apps/plugin-shell")
            .then((m) => m.open(href))
            .catch(() => window.open(href, "_blank"));
        }
      };
      el.addEventListener("click", handler, true);
      el.addEventListener("auxclick", handler, true);
      return () => {
        el.removeEventListener("click", handler, true);
        el.removeEventListener("auxclick", handler, true);
      };
    }, [fileVersion]);

    // 글쓰기 모드: 타이핑라이터(현재 줄 중앙) + 하이라이트(현재 블록만 선명)
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      const pm = el.querySelector(".ProseMirror") as HTMLElement | null;
      if (!pm) return;

      if (!writingMode) {
        // 정리: 클래스 제거
        pm.querySelectorAll(".current-block").forEach((n) => n.classList.remove("current-block"));
        return;
      }

      let raf = 0;
      const updateActiveBlock = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          let node: Node | null = sel.anchorNode;
          // ProseMirror 직계 자식까지 올라가기
          while (node && node.parentElement && node.parentElement !== pm) {
            node = node.parentElement;
          }
          const block = node instanceof HTMLElement ? node : null;
          pm.querySelectorAll(".current-block").forEach((n) => {
            if (n !== block) n.classList.remove("current-block");
          });
          if (block && !block.classList.contains("current-block")) {
            block.classList.add("current-block");
          }
          // 타이핑라이터 — caret rect를 viewport 중앙으로
          const range = sel.getRangeAt(0).cloneRange();
          range.collapse(true);
          const rect = range.getBoundingClientRect();
          // caret이 안 보이는 경우(0,0) 무시
          if (rect.top === 0 && rect.bottom === 0) return;
          const wrapper = el.closest(".editor-wrapper") as HTMLElement | null;
          const scroller = wrapper || el;
          const viewportH = scroller.clientHeight || window.innerHeight;
          const middle = viewportH / 2;
          const offset = rect.top - middle;
          if (Math.abs(offset) > 4) {
            scroller.scrollBy({ top: offset, behavior: "smooth" });
          }
        });
      };

      document.addEventListener("selectionchange", updateActiveBlock);
      pm.addEventListener("keyup", updateActiveBlock);
      pm.addEventListener("click", updateActiveBlock);
      // 최초 1회
      updateActiveBlock();

      return () => {
        document.removeEventListener("selectionchange", updateActiveBlock);
        pm.removeEventListener("keyup", updateActiveBlock);
        pm.removeEventListener("click", updateActiveBlock);
        cancelAnimationFrame(raf);
      };
    }, [writingMode, fileVersion]);

    // 작가 모드 토글 시 즉시 spellcheck 반영 (에디터 재생성 시엔 postRender가 적용).
    useEffect(() => {
      applySpellcheck();
    }, [writingMode, fileVersion, applySpellcheck]);

    return (
      <div
        ref={editorRef}
        className={`editor-content${writingMode ? " writing-mode" : ""}`}
        style={{ fontSize: `${fontSize}px` }}
      />
    );
  }
);

Editor.displayName = "Editor";
