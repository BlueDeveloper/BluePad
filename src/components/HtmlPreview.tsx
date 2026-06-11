import { useRef, useEffect } from "react";
import { useI18n } from "../i18n";

interface HtmlPreviewProps {
  content: string;
}

// 미리보기에 좌우/상하 기본 여백을 준다. 전체 문서(<html>/<!doctype>)는 본인 스타일이
// 나중에 와서 덮어쓰도록 <head> 첫머리에 "기본값"으로만 주입(비파괴) — 문서가 패딩을
// 명시하면 그쪽이 우선. 조각 HTML은 스타일을 앞에 붙인다.
const PREVIEW_PAD =
  '<style id="bp-preview-pad">html{box-sizing:border-box}body{margin:0;padding:24px clamp(16px,6vw,64px)}</style>';

function withPreviewPadding(content: string): string {
  const isFullDoc = /<html[\s>]/i.test(content) || /<!doctype/i.test(content);
  if (!isFullDoc) return PREVIEW_PAD + content;
  if (/<head[\s>]/i.test(content)) {
    return content.replace(/<head([^>]*)>/i, `<head$1>${PREVIEW_PAD}`);
  }
  if (/<html[^>]*>/i.test(content)) {
    return content.replace(/<html([^>]*)>/i, `<html$1>${PREVIEW_PAD}`);
  }
  return PREVIEW_PAD + content;
}

// HTML 파일을 실제로 렌더해 보여주는 미리보기.
// sandbox iframe으로 격리 — 미리보기 HTML의 스크립트가 BluePad 본체(Tauri API·다른 탭)에
// 접근하지 못하게 한다. allow-same-origin 미부여(불투명 origin) + 부모 CSP 상속이라
// 인라인 <style>/style 속성/data:·https: 이미지는 렌더되지만, 인라인 스크립트는
// script-src 'self'에 막혀 실행되지 않는다(의도된 안전 기본값).
export function HtmlPreview({ content }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { t } = useI18n();

  // srcDoc 직접 바인딩 대신 imperative 주입 — 큰 문서에서 React 리렌더 비용을 줄이고
  // 토글/내용 변경 시에만 갱신.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) iframe.srcdoc = withPreviewPadding(content);
  }, [content]);

  const openInBrowser = async () => {
    try {
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const shell = await import("@tauri-apps/plugin-shell");
      await shell.open(url);
      // Blob URL은 잠시 후 회수 (브라우저가 로드할 시간 확보)
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      /* ignore — 외부 브라우저 열기는 best-effort */
    }
  };

  return (
    <div className="html-preview-wrap">
      <div className="html-preview-bar">
        <span className="html-preview-label">{t("htmlPreview.label")}</span>
        <button className="html-preview-open" onClick={openInBrowser}>
          {t("htmlPreview.openInBrowser")}
        </button>
      </div>
      <iframe
        ref={iframeRef}
        className="html-preview-frame"
        title="HTML Preview"
        sandbox="allow-scripts allow-popups allow-forms allow-modals"
      />
    </div>
  );
}
