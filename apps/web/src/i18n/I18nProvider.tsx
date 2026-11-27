import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import {
  isExplanationLanguage,
  RTL_LANGUAGES,
  type ExplanationLanguage,
} from "@briefklar/shared";
import { useSettings } from "../hooks/useSettings";
import { ar } from "./locales/ar";
import { de } from "./locales/de";
import { en, type Messages } from "./locales/en";
import { ru } from "./locales/ru";
import { tr } from "./locales/tr";
import { uk } from "./locales/uk";

const MESSAGES: Record<ExplanationLanguage, Messages> = { en, de, tr, ar, uk, ru };

/** Locale for Intl formatting. Arabic keeps Latin digits, as in the German letters it explains. */
const LOCALES: Record<ExplanationLanguage, string> = {
  en: "en-GB",
  de: "de-DE",
  tr: "tr-TR",
  ar: "ar-u-nu-latn",
  uk: "uk-UA",
  ru: "ru-RU",
};

const STORAGE_KEY = "briefklar.language";

/** Last language used on this device, so the page does not flash in English while settings load */
function storedLanguage(): ExplanationLanguage | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isExplanationLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function browserLanguage(): ExplanationLanguage {
  for (const tag of navigator.languages ?? []) {
    const code = tag.slice(0, 2).toLowerCase();
    if (isExplanationLanguage(code)) return code;
  }
  return "en";
}

export interface I18n {
  language: ExplanationLanguage;
  t: Messages;
  locale: string;
  dir: "ltr" | "rtl";
  /** "2026-12-16" -> "16 December 2026" in the reader's language */
  formatDate: (isoDate: string, style?: "long" | "weekday") => string;
  formatDateTime: (iso: string) => string;
  formatMoney: (value: number, currency: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function dirOf(language: ExplanationLanguage): "ltr" | "rtl" {
  return RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const language = settings.data?.preferredLanguage ?? storedLanguage() ?? browserLanguage();

  const value = useMemo<I18n>(() => {
    const locale = LOCALES[language];
    const long = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
    const weekday = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    return {
      language,
      t: MESSAGES[language],
      locale,
      dir: dirOf(language),
      formatDate: (isoDate, style = "long") =>
        (style === "weekday" ? weekday : long).format(new Date(`${isoDate}T00:00:00Z`)),
      formatDateTime: (iso) => dateTime.format(new Date(iso)),
      formatMoney: (amount, currency) =>
        new Intl.NumberFormat(locale, { style: "currency", currency: currency || "EUR" }).format(amount),
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = value.dir;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Private mode: the language still comes from the settings
    }
  }, [language, value.dir]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
