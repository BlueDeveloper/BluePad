import { useMemo } from "react";
import { useI18n } from "../i18n";
import type { HeadingItem } from "../types";

interface SidebarProps {
  visible: boolean;
  markdown: string;
}

export function Sidebar({ visible, markdown }: SidebarProps) {
  const { t } = useI18n();
  const headings = useMemo(() => parseHeadings(markdown), [markdown]);

  if (!visible) return null;

  return (
    <div className="sidebar">
      <div className="sidebar-header">{t("sidebar.outline")}</div>
      <div className="sidebar-content">
        {headings.length === 0 ? (
          <div className="sidebar-empty">{t("sidebar.noHeadings")}</div>
        ) : (
          headings.map((h, i) => (
            <div
              key={i}
              className={`sidebar-item sidebar-h${h.level}`}
              onClick={() => scrollToHeading(h.text)}
              title={h.text}
            >
              {h.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function parseHeadings(md: string): HeadingItem[] {
  const lines = md.split("\n");
  const headings: HeadingItem[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[#*`\[\]]/g, "").trim(),
        id: match[2].trim().toLowerCase().replace(/\s+/g, "-"),
      });
    }
  }

  return headings;
}

function scrollToHeading(text: string) {
  const editorEl = document.querySelector(".editor-content");
  if (!editorEl) return;

  const headings = editorEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
  for (const h of headings) {
    if (h.textContent?.trim() === text.trim()) {
      h.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
  }
}
