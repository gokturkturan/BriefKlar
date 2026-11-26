import { EXPLANATION_LANGUAGES, type AnalysisTranslation, type ExplanationLanguage } from "@briefklar/shared";

export const TRANSLATE_ANALYSIS_PROMPT_VERSION = "translate-analysis@1";

export function translateAnalysisSystemPrompt(language: ExplanationLanguage): string {
  const target =
    language === "de"
      ? "simple German (Einfaches Deutsch, CEFR A2-B1): short sentences, common words, no Amtsdeutsch"
      : `${EXPLANATION_LANGUAGES[language]} (language code "${language}"), plain everyday language (CEFR B1)`;

  return `
You translate the analysis of an official German letter for the person who received it.
The input is JSON with English texts. Return the same JSON structure with every text
written in ${target}.

Rules:
1. Translate the meaning, not word by word. Keep it as short and clear as the English text.
2. Every list must have exactly as many items as in the input, in the same order.
   Never merge, split, add or drop items.
3. Never change names, amounts, dates, reference numbers or addresses.
4. German terms that the reader will see in the letter or at the office stay in German, in
   parentheses after the translation, e.g. "objection (Widerspruch)". Do this at most once
   per term in each text.
5. "referenceLabels" are names of reference numbers. Translate each one and keep the German
   name in parentheses, e.g. "Tax number (Steuernummer)". If the label is only a German term,
   write the translation followed by the German term in parentheses.
6. Imperative form for "requiredActions", as in the input.
`.trim();
}

export function translateAnalysisInput(language: ExplanationLanguage, texts: AnalysisTranslation): string {
  return [
    `Translate into ${EXPLANATION_LANGUAGES[language]} (${language}). Return JSON only.`,
    JSON.stringify(texts, null, 2),
  ].join("\n\n");
}
