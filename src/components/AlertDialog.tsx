import { useI18n } from "../i18n";

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

export function AlertDialog({ visible, title, message, actionLabel, onAction, onClose }: AlertDialogProps) {
  const { t } = useI18n();

  if (!visible) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box dialog-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button className="dialog-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body">
          <p className="pro-gate-msg" style={{ whiteSpace: "pre-line" }}>{message}</p>
          <div className="pro-gate-actions">
            <button className="license-deactivate-btn" onClick={onClose}>{t("dialog.close")}</button>
            {actionLabel && onAction && (
              <button className="license-activate-btn" onClick={() => { onAction(); onClose(); }}>{actionLabel}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
