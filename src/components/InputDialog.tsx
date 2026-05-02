import { useState } from "react";
import { useI18n } from "../i18n";

interface InputDialogProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({ visible, title, placeholder, defaultValue, onConfirm, onCancel }: InputDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(defaultValue || "");

  if (!visible) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box dialog-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button className="dialog-close-btn" onClick={onCancel}>×</button>
        </div>
        <div className="dialog-body">
          <input
            type="number"
            className="license-input"
            placeholder={placeholder || ""}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onConfirm(value)}
            autoFocus
          />
          <div className="pro-gate-actions">
            <button className="license-deactivate-btn" onClick={onCancel}>{t("dialog.cancel")}</button>
            <button className="license-activate-btn" onClick={() => onConfirm(value)}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
