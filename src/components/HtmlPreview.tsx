import { useRef, useEffect } from "react";
import { useI18n } from "../i18n";

interface HtmlPreviewProps {
  content: string;
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
    if (iframe) iframe.srcdoc = content;
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
