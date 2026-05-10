import { useState } from "react";
import { useI18n } from "../i18n";

interface LicenseDialogProps {
  visible: boolean;
  isPro: boolean;
  isTrial: boolean;
  licenseKey: string;
  onActivate: (key: string) => Promise<boolean>;
  onDeactivate: () => void;
  onClose: () => void;
}

export function LicenseDialog({ visible, isPro, isTrial, licenseKey: currentKey, onActivate, onDeactivate, onClose }: LicenseDialogProps) {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!visible) return null;

  const handleActivate = async () => {
    setError(false);
    setSuccess(false);
    const ok = await onActivate(key);
    if (ok) {
      setSuccess(true);
      setKey("");
    } else {
      setError(true);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{t("license.title")}</span>
          <button className="dialog-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          <div className="license-status">
            <span className="license-status-label">{t("license.status")}:</span>
            <span className={`license-badge ${isPro && !isTrial ? "pro" : isTrial ? "trial" : "free"}`}>
              {isPro && !isTrial ? t("license.pro") : isTrial ? t("license.trial") : t("license.free")}
            </span>
          </div>
          {(!isPro || isTrial) && (
            <>
              <button className="license-activate-btn" style={{ width: "100%", marginBottom: "12px" }} onClick={() => { import("@tauri-apps/plugin-shell").then(m => m.open(import.meta.env.DEV ? "https://bluepad-checkout-sandbox.blueehdwp.workers.dev/" : "https://bluepad.work/buy")).catch(() => window.open(import.meta.env.DEV ? "https://bluepad-checkout-sandbox.blueehdwp.workers.dev/" : "https://bluepad.work/buy", "_blank")); }}>
                {t("trial.buyNow")}
              </button>
              <div className="license-input-group">
                <input
                  type="text"
                  className="license-input"
                  placeholder={t("license.inputPlaceholder")}
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setError(false); setSuccess(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                />
                <button className="license-activate-btn" onClick={handleActivate}>
                  {t("license.activate")}
                </button>
              </div>
            </>
          )}
          {error && <div className="license-error">{t("license.invalid")}</div>}
          {success && <div className="license-success">{t("license.activated")}</div>}
          {isPro && !isTrial && currentKey && (
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-light)", borderRadius: "6px", padding: "10px 14px", marginBottom: "12px", fontFamily: "monospace", fontSize: "13px", userSelect: "all", wordBreak: "break-all", color: "var(--text-secondary)" }}>
              {currentKey}
            </div>
          )}
          {isPro && !isTrial && (
            <button className="license-deactivate-btn" onClick={onDeactivate}>
              {t("license.deactivate")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
