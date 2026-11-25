import { useState } from "react";
import { isExplanationLanguage, type ExplanationLanguage } from "@briefklar/shared";

const STORAGE_KEY = "briefklar.explanationLanguage";

function storedLanguage(): ExplanationLanguage {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isExplanationLanguage(value) ? value : "en";
  } catch {
    return "en";
  }
}

/** The language the user reads explanations and translations in, remembered in this browser */
export function usePreferredLanguage(): [ExplanationLanguage, (value: string) => void] {
  const [language, setLanguage] = useState<ExplanationLanguage>(storedLanguage);

  const change = (value: string) => {
    if (!isExplanationLanguage(value)) return;
    setLanguage(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage can be blocked: the choice is then only kept for this page
    }
  };

  return [language, change];
}
