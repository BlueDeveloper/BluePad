import { useMemo, useState, useCallback } from "react";
import { useI18n } from "../i18n";
import type { HeadingItem } from "../types";

interface SidebarProps {
  visible: boolean;
  markdown: string;
  onChange?: (markdown: string) => void;
}

export function Sidebar({ visible, markdown, onChange }: SidebarProps) {
  const { t } = useI18n();
  const headings = useMemo(() => parseHeadings(markdown), [markdown]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    if (!onChange) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, [onChange]);

  const handleDragLeave = useCallback(() => {
    setOverIdx(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    setOverIdx(null);
    setDragIdx(null);
    if (!onChange) return;
    const fromStr = e.dataTransfer.getData("text/plain");
    const from = parseInt(fromStr, 10);
    if (!Number.isFinite(from) || from === dropIdx) return;
    const next = moveHeadingSection(markdown, headings, from, dropIdx);
    if (next !== markdown) onChange(next);
  }, [markdown, headings, onChange]);

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
              className={`sidebar-item sidebar-h${h.level} ${dragIdx === i ? "dragging" : ""} ${overIdx === i ? "drag-over" : ""}`}
              draggable={!!onChange}
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
        lineStart: i,
      });
    }
  }

  return headings;
}

/**
 * 헤딩 from의 섹션(헤딩 + 다음 헤딩 직전까지)을 잘라서 drop 위치(헤딩 to 직전)로 이동.
 * 동급 이하 자식 섹션이 자동으로 함께 이동됨 (다음 동급/상위 헤딩 직전까지).
 */
function moveHeadingSection(md: string, headings: HeadingItem[], from: number, to: number): string {
  if (from === to) return md;
  const src = headings[from];
  const dst = headings[to];
  if (!src || !dst) return md;

  const lines = md.split("\n");
  // src 섹션 = src 헤딩 라인 ~ 다음 동급/상위 헤딩 직전
  const srcEndIdx = (() => {
    for (let k = from + 1; k < headings.length; k++) {
      if (headings[k].level <= src.level) return headings[k].lineStart;
    }
    return lines.length;
  })();
  const srcStart = src.lineStart;
  const srcEnd = srcEndIdx; // exclusive

  // dst가 src 자식 범위 안이면 무효 (자기 자식에 못 넣음)
  if (dst.lineStart >= srcStart && dst.lineStart < srcEnd) return md;

  const section = lines.slice(srcStart, srcEnd);
  // 섹션을 제거한 라인 배열
  const remaining = [...lines.slice(0, srcStart), ...lines.slice(srcEnd)];

  // 새 dst 라인 인덱스 계산 (src 제거로 인덱스 시프트 반영)
  let newDstLine = dst.lineStart;
  if (dst.lineStart > srcStart) newDstLine -= (srcEnd - srcStart);

  const inserted = [...remaining.slice(0, newDstLine), ...section, ...remaining.slice(newDstLine)];
  return inserted.join("\n");
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
