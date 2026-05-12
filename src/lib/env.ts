// 환경 감지 — 빌드/실행 환경에 따라 sandbox 모드 토글
// 우선순위: VITE_BLUEPAD_ENV=sandbox > Vite dev 모드 > live (기본)

const explicit = (import.meta.env.VITE_BLUEPAD_ENV || "").toLowerCase();
export const IS_SANDBOX: boolean =
  explicit === "sandbox" || (explicit !== "live" && import.meta.env.DEV);

export const APP_ENV: "live" | "sandbox" = IS_SANDBOX ? "sandbox" : "live";

export const CHECKOUT_URL = IS_SANDBOX
  ? "https://bluepad.work/sandbox/buy"
  : "https://bluepad.work/buy";

export const APP_DISPLAY_SUFFIX = IS_SANDBOX ? " — SANDBOX" : "";
