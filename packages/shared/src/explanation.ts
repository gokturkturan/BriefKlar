import type { ErrorCode } from "./errors";

/**
 * Plain-language explanation of a letter, streamed to the browser while the model writes it.
 */

export const EXPLANATION_LANGUAGES = {
  en: "English",
  de: "Deutsch",
  tr: "Türkçe",
  ar: "العربية",
  uk: "Українська",
  ru: "Русский",
} as const;

export type ExplanationLanguage = keyof typeof EXPLANATION_LANGUAGES;

export function isExplanationLanguage(value: unknown): value is ExplanationLanguage {
  return typeof value === "string" && Object.hasOwn(EXPLANATION_LANGUAGES, value);
}

/** Languages written from right to left, so the UI can set dir="rtl" */
export const RTL_LANGUAGES: readonly ExplanationLanguage[] = ["ar"];

export interface ExplanationDto {
  language: ExplanationLanguage;
  /** Plain text: "## " starts a heading, "- " a list item, blank lines separate paragraphs */
  content: string;
  model: string;
  createdAt: string;
}

/** Payload of each Server-Sent Event on the explanation stream */
export type ExplanationStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; explanation: ExplanationDto }
  | { type: "error"; message: string; code: ErrorCode };
