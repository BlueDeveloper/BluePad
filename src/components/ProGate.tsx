import { useI18n } from "../i18n";

interface ProGateProps {
  visible: boolean;
  onClose: () => void;
  onOpenLicense: () => void;
}

export function ProGate({ visible, onClose, onOpenLicense }: ProGateProps) {
  const { t } = useI18n();

  if (!visible) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box dialog-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{t("license.upgradeTitle")}</span>
          <button className="dialog-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          <p className="pro-gate-msg">{t("license.proFeature")}</p>
          <div className="pro-gate-actions">
            <button className="license-activate-btn" onClick={() => { import("@tauri-apps/plugin-shell").then(m => m.open(import.meta.env.DEV ? "https://bluepad-checkout-sandbox.blueehdwp.workers.dev/" : "https://checkout.bluepad.work/")).catch(() => window.open(import.meta.env.DEV ? "https://bluepad-checkout-sandbox.blueehdwp.workers.dev/" : "https://checkout.bluepad.work/", "_blank")); }}>
              {t("trial.buyNow")}
            </button>
            <button className="license-activate-btn" style={{ background: "var(--text-muted)" }} onClick={() => { onClose(); onOpenLicense(); }}>
              {t("menu.license")}
            </button>
            <button className="license-deactivate-btn" onClick={onClose}>
              {t("dialog.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
