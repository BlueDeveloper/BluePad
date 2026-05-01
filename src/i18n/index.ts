import { createContext, useContext } from "react";
import { ko } from "./ko";
import { en } from "./en";
import { ja } from "./ja";

export type LangKey = keyof typeof ko;
export type Lang = "ko" | "en" | "ja";

const locales: Record<Lang, Record<string, string>> = { ko, en, ja };

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
];

export function t(lang: Lang, key: LangKey): string {
  return locales[lang]?.[key] ?? locales.ko[key] ?? key;
}

export interface I18nContext {
  lang: Lang;
  t: (key: LangKey) => string;
}

export const I18nCtx = createContext<I18nContext>({
  lang: "ko",
  t: (key) => ko[key] ?? key,
});

export function useI18n() {
  return useContext(I18nCtx);
}
