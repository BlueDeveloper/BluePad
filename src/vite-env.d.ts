/// <reference types="vite/client" />
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_BLUEPAD_ENV?: "live" | "sandbox";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
