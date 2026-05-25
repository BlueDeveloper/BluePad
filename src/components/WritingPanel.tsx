import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "../i18n";
import type { WritingStats } from "../hooks/useWritingStats";

interface WritingPanelProps {
  stats: WritingStats;
  visible: boolean;
  onClose: () => void;
  onEditGoal: () => void;
}

const SPRINT_PRESETS = [10, 15, 25, 45]; // minutes
const SPRINT_DEFAULT_MIN = 15;
const SPRINT_KEY = "bluepad_sprint_default";

export function WritingPanel({ stats, visible, onClose, onEditGoal }: WritingPanelProps) {
  const { t } = useI18n();
  const [sprintMinutes, setSprintMinutes] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(SPRINT_KEY);
      const n = raw ? parseInt(raw, 10) : SPRINT_DEFAULT_MIN;
      return Number.isFinite(n) && n > 0 ? n : SPRINT_DEFAULT_MIN;
    } catch { return SPRINT_DEFAULT_MIN; }
  });
  const [remaining, setRemaining] = useState<number>(sprintMinutes * 60);
  const [running, setRunning] = useState<boolean>(false);
  const endRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        // 종료 알림 — 브라우저 알림 + beep
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(t("writing.sprintDone"), { body: t("writing.sprintDoneBody") });
          }
        } catch { /* ignore */ }
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        } catch { /* ignore */ }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running, t]);

  const startPause = useCallback(() => {
    if (running) {
      setRunning(false);
      return;
    }
    endRef.current = Date.now() + remaining * 1000;
    setRunning(true);
    // 알림 권한 요청 (조용히)
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }, [running, remaining]);

  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(sprintMinutes * 60);
  }, [sprintMinutes]);

  const changePreset = useCallback((m: number) => {
    setSprintMinutes(m);
    setRunning(false);
    setRemaining(m * 60);
    try { localStorage.setItem(SPRINT_KEY, String(m)); } catch { /* ignore */ }
  }, []);

  if (!visible) return null;

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const sessionMM = String(Math.floor(stats.sessionSeconds / 60)).padStart(2, "0");
  const sessionSS = String(stats.sessionSeconds % 60).padStart(2, "0");

  return (
    <aside className="writing-panel">
      <div className="writing-panel-header">
        <span className="writing-panel-title">{t("writing.title")}</span>
        <button className="writing-panel-close" onClick={onClose} title={t("writing.close")}>×</button>
      </div>

      {/* 단어 / 목표 / 진행률 */}
      <section className="writing-section">
        <div className="writing-row">
          <span className="writing-label">{t("writing.today")}</span>
          <span className="writing-value">
            <strong>{stats.todayWords.toLocaleString()}</strong>
            <span className="writing-muted"> / {stats.goal.toLocaleString()}</span>
          </span>
        </div>
        <div className="writing-progress-bar">
          <div className="writing-progress-fill" style={{ width: `${Math.round(stats.progress * 100)}%` }} />
        </div>
        <button className="writing-link-btn" onClick={onEditGoal}>{t("writing.editGoal")}</button>
      </section>

      {/* 세션 / WPM */}
      <section className="writing-section">
        <div className="writing-row">
          <span className="writing-label">{t("writing.session")}</span>
          <span className="writing-value">{sessionMM}:{sessionSS}</span>
        </div>
        <div className="writing-row">
          <span className="writing-label">WPM</span>
          <span className="writing-value">{stats.wpm}</span>
        </div>
      </section>

      {/* 스프린트 타이머 */}
      <section className="writing-section">
        <div className="writing-section-title">{t("writing.sprint")}</div>
        <div className="writing-sprint-timer">{mm}:{ss}</div>
        <div className="writing-sprint-controls">
          <button className="writing-btn" onClick={startPause}>
            {running ? t("writing.pause") : t("writing.start")}
          </button>
          <button className="writing-btn-secondary" onClick={reset}>{t("writing.reset")}</button>
        </div>
        <div className="writing-sprint-presets">
          {SPRINT_PRESETS.map((m) => (
            <button
              key={m}
              className={`writing-preset ${sprintMinutes === m ? "active" : ""}`}
              onClick={() => changePreset(m)}
            >
              {m}m
            </button>
          ))}
        </div>
      </section>

      {/* 히트맵 (30일) */}
      <section className="writing-section">
        <div className="writing-section-title">{t("writing.heatmap")}</div>
        <div className="writing-heatmap">
          {stats.heatmap.map((d) => (
            <div
              key={d.date}
              className={`writing-heatmap-cell level-${d.level}`}
              title={`${d.date}: ${d.words} ${t("writing.words")}`}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}
