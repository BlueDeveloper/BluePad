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

interface EditorProps {
  content: string;
  fileVersion: number;
  fontSize: number;
  onChange: (markdown: string) => void;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(
  ({ content, fileVersion, fontSize, onChange }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const milkdownRef = useRef<MilkdownEditor | null>(null);
    const contentRef = useRef(content);

    contentRef.current = content;

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

      MilkdownEditor.make()
        .config((ctx) => {
          ctx.set(rootCtx, el);
          ctx.set(defaultValueCtx, contentRef.current);
          ctx.set(prismConfig.key, { configureRefractor: () => refractor });
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            contentRef.current = markdown;
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

    return (
      <div
        ref={editorRef}
        className="editor-content"
        style={{ fontSize: `${fontSize}px` }}
      />
    );
  }
);

Editor.displayName = "Editor";
