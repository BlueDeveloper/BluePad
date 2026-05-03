import { useI18n } from "../i18n";

interface AboutDialogProps {
  visible: boolean;
  isPro: boolean;
  isTrial: boolean;
  onClose: () => void;
}

const OSS_LIBRARIES = [
  { name: "Tauri", license: "MIT / Apache 2.0", url: "https://github.com/tauri-apps/tauri" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Milkdown", license: "MIT", url: "https://github.com/Milkdown/milkdown" },
  { name: "ProseMirror", license: "MIT", url: "https://github.com/ProseMirror/prosemirror" },
  { name: "KaTeX", license: "MIT", url: "https://github.com/KaTeX/KaTeX" },
  { name: "Mermaid.js", license: "MIT", url: "https://github.com/mermaid-js/mermaid" },
  { name: "Prism.js", license: "MIT", url: "https://github.com/PrismJS/prism" },
  { name: "Refractor", license: "MIT", url: "https://github.com/wooorm/refractor" },
  { name: "Vite", license: "MIT", url: "https://github.com/vitejs/vite" },
];

export function AboutDialog({ visible, isPro, isTrial, onClose }: AboutDialogProps) {
  const { t } = useI18n();

  if (!visible) return null;

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{t("menu.about")}</span>
          <button className="dialog-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          <div className="about-hero">
            <h2 className="about-app-name">BluePad</h2>
            <div className="about-version">{t("about.version")} 1.0.0</div>
            <div className="about-tagline">{t("about.tagline")}</div>
            <span className={`license-badge ${isPro && !isTrial ? "pro" : isTrial ? "trial" : "free"}`}>
              {isPro && !isTrial ? "Pro" : isTrial ? "Trial" : "Free"}
            </span>
          </div>

          <div className="about-meta">
            <div className="about-copyright">{t("about.copyright")}</div>
            <div className="about-website">
              <span>{t("about.website")}: </span>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); openExternal("https://bluepad.work"); }}
              >
                bluepad.work
              </a>
            </div>
          </div>

          <div className="about-oss">
            <h3 className="about-oss-title">{t("about.ossTitle")}</h3>
            <ul className="about-oss-list">
              {OSS_LIBRARIES.map((lib) => (
                <li key={lib.name} className="about-oss-item">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); openExternal(lib.url); }}
                    className="about-oss-link"
                  >
                    {lib.name}
                  </a>
                  <span className="about-oss-license">{lib.license}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
