import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

const LICENSE_KEY = "bluepad_license_key";
const LICENSE_STATUS_KEY = "bluepad_license_status";
const DEVICE_ID_KEY = "bluepad_device_id";
const LICENSE_VALIDATED_AT_KEY = "bluepad_license_validated_at";
const API_URL = "https://bluepad-license-api.blueehdwp.workers.dev";

const OFFLINE_GRACE_DAYS = 30;
const OFFLINE_GRACE_MS = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type ProFeature = "unlimitedTabs" | "allThemes" | "exportHtml" | "autoSave" | "focusMode" | "mermaid" | "math";

/** Check if the last online validation timestamp is within the offline grace window */
function isOfflineGracePeriodValid(): boolean {
  const ts = localStorage.getItem(LICENSE_VALIDATED_AT_KEY);
  if (!ts) return false;
  const elapsed = Date.now() - Number(ts);
  return elapsed >= 0 && elapsed < OFFLINE_GRACE_MS;
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
  let seed = localStorage.getItem(SEED_KEY);
  if (!seed) {
    seed = crypto.randomUUID();
    try { localStorage.setItem(SEED_KEY, seed); } catch { /* ignore */ }
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

export function useLicense() {
  const [isPro, setIsPro] = useState(() => {
    if (localStorage.getItem(LICENSE_STATUS_KEY) !== "pro") return false;
    // Offline grace period check on init
    return isOfflineGracePeriodValid();
  });
  const [licenseKey, setLicenseKey] = useState(() => {
    return localStorage.getItem(LICENSE_KEY) || "";
  });
  const validating = useRef(false);

  const activate = useCallback(async (key: string): Promise<boolean> => {
    const trimmed = key.trim().toUpperCase();
    if (!/^BP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
      return false;
    }

    try {
      const deviceId = await getDeviceId();
      const deviceName = await getDeviceName();

      const res = await fetch(`${API_URL}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        setLicenseKey(trimmed);
        setIsPro(true);
        return true;
      }

      return false;
    } catch {
      // Offline fallback: if previously validated within grace period, keep pro status
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ license_key: key, device_id: deviceId }),
        });
      } catch {
        // ignore network error on deactivate
      }
    }

    localStorage.removeItem(LICENSE_KEY);
    localStorage.removeItem(LICENSE_STATUS_KEY);
    localStorage.removeItem(LICENSE_VALIDATED_AT_KEY);
    setLicenseKey("");
    setIsPro(false);
  }, []);

  const canUse = useCallback(
    (_feature: ProFeature): boolean => {
      return isPro;
    },
    [isPro]
  );

  const maxTabs = isPro ? Infinity : 3;

  // Re-validate on app startup
  useEffect(() => {
    const storedKey = localStorage.getItem(LICENSE_KEY);
    if (storedKey && !validating.current) {
      validating.current = true;
      activate(storedKey).finally(() => {
        validating.current = false;
      });
    }
  }, [activate]);

  return {
    isPro,
    licenseKey,
    maxTabs,
    activate,
    deactivate,
    canUse,
  };
}
