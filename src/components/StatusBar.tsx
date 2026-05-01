import { useI18n } from "../i18n";

interface StatusBarProps {
  chars: number;
  words: number;
  lines: number;
  filePath: string | null;
  sourceMode: boolean;
  autoSave: boolean;
  fontSize: number;
  isPro: boolean;
}

export function StatusBar({ chars, words, lines, filePath, sourceMode, autoSave, fontSize, isPro }: StatusBarProps) {
  const { t } = useI18n();
  return (
    <div className="statusbar">
      <span className="statusbar-item statusbar-path">
        {filePath ?? t("status.newFile")}
      </span>
      <div className="statusbar-right">
        <span className={`statusbar-badge ${isPro ? "statusbar-badge-pro" : "statusbar-badge-free"}`}>
          {isPro ? t("status.pro") : t("status.free")}
        </span>
        {sourceMode && <span className="statusbar-badge">{t("status.source")}</span>}
        {autoSave && <span className="statusbar-badge statusbar-badge-auto">{t("status.autoSave")}</span>}
        <span className="statusbar-item">{fontSize}px</span>
        <span className="statusbar-item">{lines} {t("status.lines")}</span>
        <span className="statusbar-item">{words} {t("status.words")}</span>
        <span className="statusbar-item">{chars} {t("status.chars")}</span>
      </div>
    </div>
  );
}
