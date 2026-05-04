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
              <p className="pro-gate-msg">{t("update.downloading")}</p>
              <div className="update-progress-bar">
                <div className="update-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="pro-gate-msg" style={{ textAlign: "center", fontSize: "0.85rem" }}>{progress}%</p>
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
              {error && <p className="license-error" style={{ wordBreak: "break-all" }}>{error}</p>}
              <div className="pro-gate-actions">
                <button className="license-deactivate-btn" onClick={onClose}>{t("dialog.close")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
