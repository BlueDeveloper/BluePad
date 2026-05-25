import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 글쓰기 모드 통계 훅.
 * - 오늘 작성한 단어 수 / 일일 목표 / 진행률
 * - 세션 경과 시간 (글쓰기 모드 ON 시점부터)
 * - 실시간 WPM (최근 60초 슬라이딩 윈도우)
 * - 30일 히트맵 데이터 (날짜별 작성 단어 수)
 *
 * 모든 데이터는 localStorage 기반 (서버 없이 동작).
 */

const HEATMAP_KEY = "bluepad_writing_heatmap";
const DAILY_BASELINE_KEY = "bluepad_writing_baseline";
const DAILY_GOAL_KEY = "bluepad_daily_word_goal";
const HEATMAP_DAYS = 30;
const WPM_WINDOW_MS = 60_000;

interface BaselineEntry { date: string; words: number; }
interface HeatmapMap { [date: string]: number; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countWords(text: string): number {
  if (!text) return 0;
  // 한글 등 비공백 언어는 글자수, 영문은 단어수 기준 — 단순화: 공백/줄바꿈/구두점 기준 토큰
  const t = text.replace(/[#*`>~|\-_=\[\]()!]/g, " ").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function loadHeatmap(): HeatmapMap {
  try {
    const raw = localStorage.getItem(HEATMAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch { return {}; }
}

function pruneHeatmap(map: HeatmapMap): HeatmapMap {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HEATMAP_DAYS);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const next: HeatmapMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (k >= cutoffStr) next[k] = v;
  }
  return next;
}

export interface WritingStats {
  todayWords: number;
  goal: number;
  progress: number; // 0~1
  sessionSeconds: number;
  wpm: number;
  heatmap: { date: string; words: number; level: number }[]; // 30일치, 오래된 순
  setGoal: (g: number) => void;
}

export function useWritingStats(content: string, active: boolean): WritingStats {
  const [goal, setGoalState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(DAILY_GOAL_KEY);
      const n = raw ? parseInt(raw, 10) : 500;
      return Number.isFinite(n) && n > 0 ? n : 500;
    } catch { return 500; }
  });

  const [todayWords, setTodayWords] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [heatmap, setHeatmap] = useState<{ date: string; words: number; level: number }[]>([]);

  // baseline = active=true 된 시점의 오늘 단어수. 이 시점 이후 증감을 today 카운트로.
  const baselineRef = useRef<BaselineEntry | null>(null);
  const sessionStartRef = useRef<number>(0);
  // WPM 추적: { ts, words } 슬라이딩
  const wpmSamplesRef = useRef<{ ts: number; words: number }[]>([]);

  // 활성/비활성 전환 시 baseline 설정
  useEffect(() => {
    if (!active) {
      baselineRef.current = null;
      sessionStartRef.current = 0;
      wpmSamplesRef.current = [];
      setSessionSeconds(0);
      setWpm(0);
      return;
    }
    const date = todayStr();
    const words = countWords(content);
    // 같은 날 baseline 있으면 유지, 다른 날이면 새로
    try {
      const raw = localStorage.getItem(DAILY_BASELINE_KEY);
      if (raw) {
        const prev: BaselineEntry = JSON.parse(raw);
        if (prev.date === date && prev.words <= words) {
          baselineRef.current = prev;
        } else {
          baselineRef.current = { date, words };
          localStorage.setItem(DAILY_BASELINE_KEY, JSON.stringify(baselineRef.current));
        }
      } else {
        baselineRef.current = { date, words };
        localStorage.setItem(DAILY_BASELINE_KEY, JSON.stringify(baselineRef.current));
      }
    } catch {
      baselineRef.current = { date, words };
    }
    sessionStartRef.current = Date.now();
    wpmSamplesRef.current = [{ ts: Date.now(), words }];
  }, [active]); // content는 의존성 제외 — 매 키스트로크마다 reset되면 안 됨

  // content 변경 시 today/heatmap/WPM 업데이트
  useEffect(() => {
    if (!active || !baselineRef.current) return;
    const date = todayStr();
    const words = countWords(content);
    // baseline date가 오늘이 아니면 갱신
    if (baselineRef.current.date !== date) {
      baselineRef.current = { date, words };
      try { localStorage.setItem(DAILY_BASELINE_KEY, JSON.stringify(baselineRef.current)); } catch { /* ignore */ }
    }
    const delta = Math.max(0, words - baselineRef.current.words);
    setTodayWords(delta);

    // heatmap 업데이트
    const map = pruneHeatmap(loadHeatmap());
    const prev = map[date] || 0;
    if (delta > prev) map[date] = delta;
    try { localStorage.setItem(HEATMAP_KEY, JSON.stringify(map)); } catch { /* ignore */ }
    setHeatmap(buildHeatmap(map));

    // WPM 샘플 추가
    const now = Date.now();
    wpmSamplesRef.current.push({ ts: now, words });
    // window 밖 제거
    wpmSamplesRef.current = wpmSamplesRef.current.filter((s) => now - s.ts <= WPM_WINDOW_MS);
  }, [content, active]);

  // 1초 인터벌로 세션 시간 + WPM 갱신
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (sessionStartRef.current > 0) {
        setSessionSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
      const samples = wpmSamplesRef.current;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = (last.ts - first.ts) / 1000;
        const dw = last.words - first.words;
        if (dt > 0 && dw > 0) {
          setWpm(Math.round((dw / dt) * 60));
        } else {
          setWpm(0);
        }
      } else {
        setWpm(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  // 초기 히트맵 로드
  useEffect(() => {
    setHeatmap(buildHeatmap(pruneHeatmap(loadHeatmap())));
  }, []);

  const setGoal = useCallback((g: number) => {
    const v = Math.max(1, Math.min(g, 1_000_000));
    setGoalState(v);
    try { localStorage.setItem(DAILY_GOAL_KEY, String(v)); } catch { /* ignore */ }
  }, []);

  const progress = goal > 0 ? Math.min(1, todayWords / goal) : 0;

  return { todayWords, goal, progress, sessionSeconds, wpm, heatmap, setGoal };
}

function buildHeatmap(map: HeatmapMap): { date: string; words: number; level: number }[] {
  const out: { date: string; words: number; level: number }[] = [];
  const today = new Date();
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const words = map[key] || 0;
    let level = 0;
    if (words > 0) level = 1;
    if (words >= 100) level = 2;
    if (words >= 500) level = 3;
    if (words >= 1000) level = 4;
    out.push({ date: key, words, level });
  }
  return out;
}
