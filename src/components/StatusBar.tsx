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
  isTrial: boolean;
  trialDaysLeft: number;
  wordTarget: number | null;
  selectionCount: number;
}

export function StatusBar({ chars, words, lines, filePath, sourceMode, autoSave, fontSize, isPro, isTrial, trialDaysLeft, wordTarget, selectionCount }: StatusBarProps) {
  const { t } = useI18n();
  const progress = wordTarget ? Math.min(100, Math.round((words / wordTarget) * 100)) : 0;
  const readingMin = Math.max(1, Math.ceil(words / 200));
  return (
    <div className="statusbar">
      <span className="statusbar-item statusbar-path">
        {filePath ?? t("status.newFile")}
      </span>
      <div className="statusbar-right">
        {isTrial ? (
          <span className="statusbar-badge statusbar-badge-trial">
            {t("status.trial").replace("{days}", String(trialDaysLeft))}
          </span>
        ) : (
          <span className={`statusbar-badge ${isPro ? "statusbar-badge-pro" : "statusbar-badge-free"}`}>
            {isPro ? t("status.pro") : t("status.free")}
          </span>
        )}
        {sourceMode && <span className="statusbar-badge">{t("status.source")}</span>}
        {autoSave && <span className="statusbar-badge statusbar-badge-auto">{t("status.autoSave")}</span>}
        {wordTarget && (
          <span className="statusbar-item statusbar-word-target">
            <span className="statusbar-word-target-label">{t("status.wordTarget")}: {words} / {wordTarget}</span>
            <span className="statusbar-progress">
              <span className="statusbar-progress-bar" style={{ width: `${progress}%` }} />
            </span>
          </span>
        )}
        <span className="statusbar-item">{fontSize}px</span>
        <span className="statusbar-item">{t("status.readingTime").replace("{min}", String(readingMin))}</span>
        <span className="statusbar-item">{lines} {t("status.lines")}</span>
        <span className="statusbar-item">{words} {t("status.words")}</span>
        <span className="statusbar-item">{chars} {t("status.chars")}</span>
        {selectionCount > 0 && (
          <span className="statusbar-item statusbar-selection">{t("status.selected").replace("{count}", String(selectionCount))}</span>
        )}
      </div>
    </div>
  );
}
