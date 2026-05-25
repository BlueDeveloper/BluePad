import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { APP_ENV } from "../lib/env";

// 모든 license API fetch에 환경 헤더 첨부 (Live/Sandbox 분리)
const ENV_HEADERS = { "Content-Type": "application/json", "X-Environment": APP_ENV } as const;

const LICENSE_KEY = "bluepad_license_key";
const LICENSE_STATUS_KEY = "bluepad_license_status";
const DEVICE_ID_KEY = "bluepad_device_id";
const LICENSE_VALIDATED_AT_KEY = "bluepad_license_validated_at";
const TRIAL_START_KEY = "bluepad_trial_start";
const VALIDATION_HASH_KEY = "bluepad_vh";
const LAST_SEEN_TIME_KEY = "bluepad_lst";
const API_URL = "https://bluepad-license-api.blueehdwp.workers.dev";

const OFFLINE_GRACE_DAYS = 30;
const OFFLINE_GRACE_MS = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 14;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
// 시계 변조 허용치: 활성화 이후 시계를 7일 넘게 과거로 돌리면 grace period 무효 처리.
const CLOCK_TAMPER_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

export type ProFeature = "unlimitedTabs" | "allThemes" | "exportHtml" | "focusMode";

/** Compute a validation hash to prevent trivial localStorage manipulation */
async function computeValidationHash(licenseKey: string, deviceId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(licenseKey + ":" + deviceId + ":bluepad-integrity-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** Monotonically bump the "last seen" timestamp. Detects backward clock changes. */
function bumpLastSeen(): void {
  try {
    const prev = Number(localStorage.getItem(LAST_SEEN_TIME_KEY) || "0");
    const now = Date.now();
    if (now > prev) localStorage.setItem(LAST_SEEN_TIME_KEY, String(now));
  } catch { /* ignore */ }
}

/** Return true if the system clock has been moved backward more than the tolerance. */
function isClockTampered(): boolean {
  const lastSeen = Number(localStorage.getItem(LAST_SEEN_TIME_KEY) || "0");
  if (lastSeen === 0) return false;
  // 현재 시간이 마지막으로 본 시점보다 7일 이상 과거면 시계 역행으로 판단.
  return Date.now() + CLOCK_TAMPER_TOLERANCE_MS < lastSeen;
}

/** Check if the last online validation timestamp is within the offline grace window */
function isOfflineGracePeriodValid(): boolean {
  if (isClockTampered()) return false;
  const ts = localStorage.getItem(LICENSE_VALIDATED_AT_KEY);
  if (!ts) return false;
  const validatedAt = Number(ts);
  // 미래로 설정된 timestamp 거부 (역방향 검증)
  if (validatedAt > Date.now() + CLOCK_TAMPER_TOLERANCE_MS) return false;
  const elapsed = Date.now() - validatedAt;
  return elapsed >= 0 && elapsed < OFFLINE_GRACE_MS;
}

/** Get trial state from localStorage (offline fallback) */
function getLocalTrialState(): { isTrial: boolean; trialDaysLeft: number } {
  const trialStart = localStorage.getItem(TRIAL_START_KEY);
  if (!trialStart) {
    return { isTrial: false, trialDaysLeft: 0 };
  }

  const elapsed = Date.now() - Number(trialStart);
  if (elapsed < 0 || elapsed >= TRIAL_MS) {
    return { isTrial: false, trialDaysLeft: 0 };
  }

  const daysLeft = Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000));
  return { isTrial: true, trialDaysLeft: daysLeft };
}

/** Device ID cache – resolved once per session */
let cachedDeviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  // Check localStorage cache first
  const cached = localStorage.getItem(DEVICE_ID_KEY);
  if (cached && cached.startsWith("bp-h-")) {
    cachedDeviceId = cached;
    return cached;
  }

  // Get or create a random seed stored alongside the hostname
  const SEED_KEY = "bluepad_device_seed";
  let seed: string | null = null;

  // Try to read seed from persistent file (survives localStorage clear)
  const SEED_FILE = "bluepad_device_seed.dat";
  try {
    const { readTextFile, writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    try {
      seed = await readTextFile(SEED_FILE, { baseDir: BaseDirectory.AppData });
    } catch {
      // File doesn't exist, check localStorage or create new
      seed = localStorage.getItem(SEED_KEY);
      if (!seed) {
        seed = crypto.randomUUID();
      }
      await writeTextFile(SEED_FILE, seed, { baseDir: BaseDirectory.AppData });
    }
    try { localStorage.setItem(SEED_KEY, seed); } catch { /* ignore */ }
  } catch {
    // Not in Tauri (browser), use localStorage only
    seed = localStorage.getItem(SEED_KEY);
    if (!seed) {
      seed = crypto.randomUUID();
      try { localStorage.setItem(SEED_KEY, seed); } catch { /* ignore */ }
    }
  }

  let hostname = "unknown";
  try {
    hostname = await invoke<string>("get_hostname");
  } catch {
    // fallback – use navigator info
    hostname = navigator.userAgent.slice(0, 60);
  }

  // Hash hostname + seed via SubtleCrypto
  const encoder = new TextEncoder();
  const data = encoder.encode(hostname + ":" + seed);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const id = "bp-h-" + hashHex.slice(0, 32);
  try { localStorage.setItem(DEVICE_ID_KEY, id); } catch { /* ignore */ }
  cachedDeviceId = id;
  return id;
}

async function getDeviceName(): Promise<string> {
  try {
    const hostname = await invoke<string>("get_hostname");
    return hostname;
  } catch {
    return navigator.userAgent.slice(0, 60);
  }
}

/** Fetch trial state from server, falls back to localStorage */
async function syncTrialWithServer(deviceId: string): Promise<{ isTrial: boolean; trialDaysLeft: number }> {
  try {
    const deviceName = await getDeviceName();
    const res = await fetch(`${API_URL}/api/trial`, {
      method: "POST",
      headers: ENV_HEADERS,
      body: JSON.stringify({ device_id: deviceId, device_name: deviceName }),
    });
    const data = await res.json();

    // Save server trial_start to localStorage for offline fallback
    if (data.trial_start) {
      const startMs = typeof data.trial_start === "string" && data.trial_start.includes("T")
        ? new Date(data.trial_start).getTime()
        : new Date(data.trial_start + "Z").getTime();
      try { localStorage.setItem(TRIAL_START_KEY, String(startMs)); } catch { /* ignore */ }
    }

    if (data.expired) {
      return { isTrial: false, trialDaysLeft: 0 };
    }
    return { isTrial: true, trialDaysLeft: data.days_left };
  } catch {
    // Offline: use localStorage fallback
    return getLocalTrialState();
  }
}

export function useLicense() {
  const [hasLicense, setHasLicense] = useState(() => {
    if (localStorage.getItem(LICENSE_STATUS_KEY) !== "pro") return false;
    if (!localStorage.getItem(LICENSE_KEY)) return false; // no key = can't be pro
    return isOfflineGracePeriodValid();
  });
  const [trialState, setTrialState] = useState(getLocalTrialState);
  const [licenseKey, setLicenseKey] = useState(() => {
    return localStorage.getItem(LICENSE_KEY) || "";
  });
  const validating = useRef(false);
  const trialSynced = useRef(false);

  const isTrial = !hasLicense && trialState.isTrial;
  const isPro = hasLicense || isTrial;
  const trialDaysLeft = trialState.trialDaysLeft;

  const activate = useCallback(async (key: string): Promise<boolean> => {
    const trimmed = key.trim().toUpperCase();
    if (!/^(BP|BPSB)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
      return false;
    }
    // 환경 일치 검증 — Live 앱에서 BPSB- 키 / Sandbox 앱에서 BP- 키 모두 차단
    const keyEnv = trimmed.startsWith("BPSB-") ? "sandbox" : "live";
    if (keyEnv !== APP_ENV) {
      return false;
    }

    try {
      const deviceId = await getDeviceId();
      const deviceName = await getDeviceName();

      const res = await fetch(`${API_URL}/api/validate`, {
        method: "POST",
        headers: ENV_HEADERS,
        body: JSON.stringify({
          license_key: trimmed,
          device_id: deviceId,
          device_name: deviceName,
        }),
      });

      const data = await res.json();

      if (data.valid && data.pro) {
        try { localStorage.setItem(LICENSE_KEY, trimmed); } catch { /* ignore */ }
        try { localStorage.setItem(LICENSE_STATUS_KEY, "pro"); } catch { /* ignore */ }
        try { localStorage.setItem(LICENSE_VALIDATED_AT_KEY, String(Date.now())); } catch { /* ignore */ }
        bumpLastSeen();
        const vh = await computeValidationHash(trimmed, deviceId);
        try { localStorage.setItem(VALIDATION_HASH_KEY, vh); } catch { /* ignore */ }
        setLicenseKey(trimmed);
        setHasLicense(true);
        return true;
      }

      // Server explicitly rejected — clear cached Pro status
      localStorage.removeItem(LICENSE_KEY);
      localStorage.removeItem(LICENSE_STATUS_KEY);
      localStorage.removeItem(LICENSE_VALIDATED_AT_KEY);
      localStorage.removeItem(VALIDATION_HASH_KEY);
      setLicenseKey("");
      setHasLicense(false);
      return false;
    } catch {
      // Offline fallback: 시계 역방향(미래 timestamp) + 역방향(시계 과거 이동) 모두 isOfflineGracePeriodValid()에서 차단.
      if (
        localStorage.getItem(LICENSE_STATUS_KEY) === "pro" &&
        localStorage.getItem(LICENSE_KEY) === trimmed &&
        isOfflineGracePeriodValid()
      ) {
        return true;
      }
      return false;
    }
  }, []);

  const deactivate = useCallback(async () => {
    const key = localStorage.getItem(LICENSE_KEY);
    const deviceId = await getDeviceId();

    if (key) {
      try {
        await fetch(`${API_URL}/api/deactivate`, {
          method: "POST",
          headers: ENV_HEADERS,
          body: JSON.stringify({ license_key: key, device_id: deviceId }),
        });
      } catch {
        // ignore network error on deactivate
      }
    }

    localStorage.removeItem(LICENSE_KEY);
    localStorage.removeItem(LICENSE_STATUS_KEY);
    localStorage.removeItem(LICENSE_VALIDATED_AT_KEY);
    localStorage.removeItem(VALIDATION_HASH_KEY);
    setLicenseKey("");
    setHasLicense(false);
  }, []);

  const canUse = useCallback(
    (_feature: ProFeature): boolean => {
      return isPro;
    },
    [isPro]
  );

  const maxTabs = isPro ? Infinity : 3;

  // Sync trial with server on startup
  useEffect(() => {
    if (!hasLicense && !trialSynced.current) {
      trialSynced.current = true;
      getDeviceId().then((deviceId) => {
        syncTrialWithServer(deviceId).then((serverTrial) => {
          setTrialState(serverTrial);
        });
      });
    }
  }, [hasLicense]);

  // Re-validate license on app startup (with hash integrity check)
  useEffect(() => {
    const storedKey = localStorage.getItem(LICENSE_KEY);
    if (storedKey && !validating.current) {
      validating.current = true;
      // Verify validation hash before attempting re-validation
      getDeviceId().then(async (deviceId) => {
        const storedHash = localStorage.getItem(VALIDATION_HASH_KEY);
        const expectedHash = await computeValidationHash(storedKey, deviceId);
        if (storedHash && storedHash !== expectedHash) {
          // Hash mismatch — localStorage was tampered with
          localStorage.removeItem(LICENSE_KEY);
          localStorage.removeItem(LICENSE_STATUS_KEY);
          localStorage.removeItem(LICENSE_VALIDATED_AT_KEY);
          localStorage.removeItem(VALIDATION_HASH_KEY);
          setLicenseKey("");
          setHasLicense(false);
          validating.current = false;
          return;
        }
        activate(storedKey).finally(() => {
          validating.current = false;
        });
      });
    } else if (!storedKey && localStorage.getItem(LICENSE_STATUS_KEY) === "pro") {
      // Someone set status=pro without a key — clear it
      localStorage.removeItem(LICENSE_STATUS_KEY);
      localStorage.removeItem(VALIDATION_HASH_KEY);
      setHasLicense(false);
    }
  }, [activate]);

  // Refresh trial state periodically (every minute) + bump last-seen monotonic clock
  useEffect(() => {
    bumpLastSeen();
    const timer = setInterval(() => {
      bumpLastSeen();
      setTrialState(getLocalTrialState());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 백그라운드 라이선스 재검증 (1시간 간격) — 환불/비활성화가 다음 재시작 전에도 반영되도록
  // activate()는 서버가 명시적으로 invalid_key를 반환하면 localStorage 정리하고 Free로 강등.
  // 네트워크 오류 시엔 offline grace period(30일) 내에서 Pro 유지(시계 역행 검증 포함).
  useEffect(() => {
    if (!hasLicense) return;
    const REVALIDATE_INTERVAL_MS = 60 * 60 * 1000;
    const timer = setInterval(() => {
      const stored = localStorage.getItem(LICENSE_KEY);
      if (stored) activate(stored);
    }, REVALIDATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasLicense, activate]);

  return {
    isPro,
    isTrial,
    trialDaysLeft,
    licenseKey,
    maxTabs,
    activate,
    deactivate,
    canUse,
  };
}
