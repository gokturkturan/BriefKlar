import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

/** Last language used on this device: shown before signing in and while the settings load */
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
  /** Changes the language of the whole site; stored in the settings once signed in */
  setLanguage: (value: string) => void;
}

const I18nContext = createContext<I18n | null>(null);

export function dirOf(language: ExplanationLanguage): "ltr" | "rtl" {
  return RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const saveLanguage = update.mutate;
  const [deviceLanguage, setDeviceLanguage] = useState(() => storedLanguage() ?? browserLanguage());
  const language = settings.data?.preferredLanguage ?? deviceLanguage;
  const signedIn = settings.data !== undefined;

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
      formatMoney: (amount, currency) => formatAmount(locale, amount, currency),
      setLanguage: (value) => {
        if (!isExplanationLanguage(value) || value === language) return;
        setDeviceLanguage(value);
        if (signedIn) saveLanguage({ preferredLanguage: value });
      },
    };
  }, [language, signedIn, saveLanguage]);

  useEffect(() => {
    // After signing out, the site stays in the language the user had
    setDeviceLanguage(language);
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

/**
 * Amounts come from the letter, so the "currency" is not always an ISO code:
 * price letters give unit prices such as "ct/kWh" or "EUR/Monat", which
 * Intl rejects with a RangeError. Those are shown as a number plus the unit.
 */
function formatAmount(locale: string, amount: number, currency: string): string {
  const code = currency.trim() || "EUR";
  if (/^[A-Za-z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(amount);
    } catch {
      // Not a currency Intl knows: fall through to number + unit
    }
  }
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  return `${number} ${code}`;
}
