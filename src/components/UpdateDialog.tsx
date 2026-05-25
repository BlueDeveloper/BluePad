import { useI18n } from "../i18n";
import type { UpdateStatus } from "../hooks/useUpdater";

interface UpdateDialogProps {
  open: boolean;
  status: UpdateStatus;
  progress: number;
  newVersion: string;
  releaseNotes: string;
  error: string;
  onCheck: () => Promise<void>;
  onDownload: () => Promise<void>;
  onRestart: () => Promise<void>;
  onClose: () => void;
}

export function UpdateDialog({
  open,
  status,
  progress,
  newVersion,
  releaseNotes,
  error,
  onCheck,
  onDownload,
  onRestart,
  onClose,
}: UpdateDialogProps) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box dialog-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{t("update.title")}</span>
          <button className="dialog-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          {status === "idle" && (
            <>
              <p className="pro-gate-msg">{t("update.checkDescription")}</p>
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("dialog.close")}</button>
                <button className="license-activate-btn" onClick={onCheck}>{t("update.checkNow")}</button>
              </div>
            </>
          )}

          {status === "checking" && (
            <p className="pro-gate-msg">{t("update.checking")}</p>
          )}

          {status === "latest" && (
            <>
              <p className="pro-gate-msg">{t("update.latest")}</p>
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("dialog.close")}</button>
              </div>
            </>
          )}

          {status === "available" && (
            <>
              <p className="pro-gate-msg">{t("update.available").replace("{version}", newVersion)}</p>
              {releaseNotes && <div className="update-notes">{releaseNotes}</div>}
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("update.later")}</button>
                <button className="license-activate-btn" onClick={onDownload}>{t("update.downloadInstall")}</button>
              </div>
            </>
          )}

          {status === "downloading" && (
            <>
              <div className="update-progress-row">
                <span className="update-progress-label">{t("update.downloading")}</span>
                <span className="update-progress-pct">{progress}%</span>
              </div>
              <div className="update-progress-bar">
                <div className="update-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}

          {status === "done" && (
            <>
              <p className="pro-gate-msg">{t("update.done")}</p>
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("update.later")}</button>
                <button className="license-activate-btn" onClick={onRestart}>{t("update.restart")}</button>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <p className="pro-gate-msg">{t("update.error")}</p>
              {error && <p className="update-error">{error}</p>}
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("dialog.close")}</button>
              </div>
            </>
          )}

          {status === "unsupported" && (
            <>
              <p className="pro-gate-msg">{t("update.unsupported")}</p>
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("dialog.close")}</button>
                <button
                  className="license-activate-btn"
                  onClick={() => {
                    const lang = (navigator.language || "ko").toLowerCase();
                    const path = lang.startsWith("ja") ? "/ja/download/" : lang.startsWith("en") ? "/en/download/" : "/ko/download/";
                    const url = `https://bluepad.work${path}`;
                    import("@tauri-apps/plugin-shell").then((m) => m.open(url)).catch(() => window.open(url, "_blank"));
                  }}
                >{t("update.openDownload")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
