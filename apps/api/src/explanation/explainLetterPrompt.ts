import { EXPLANATION_LANGUAGES, type ExplanationLanguage } from "@briefklar/shared";

export const EXPLAIN_LETTER_PROMPT_VERSION = "explain-letter@2";

/** Headings are fixed per language: models keep English headings when asked to translate them */
const HEADINGS: Record<ExplanationLanguage, [string, string, string, string]> = {
  en: ["What is this letter?", "What does it mean for you?", "What do you need to do?", "Important words"],
  de: ["Was ist das für ein Brief?", "Was bedeutet das für Sie?", "Was müssen Sie tun?", "Wichtige Wörter"],
  tr: ["Bu mektup ne?", "Sizin için ne anlama geliyor?", "Ne yapmanız gerekiyor?", "Önemli kelimeler"],
  ar: ["ما هذه الرسالة؟", "ماذا تعني بالنسبة لك؟", "ماذا عليك أن تفعل؟", "كلمات مهمة"],
  uk: ["Що це за лист?", "Що це означає для вас?", "Що вам потрібно зробити?", "Важливі слова"],
  ru: ["Что это за письмо?", "Что это значит для вас?", "Что вам нужно сделать?", "Важные слова"],
};

/** Repeated in the user message: smaller models tend to answer in the language of the examples */
export function explainLetterInstruction(language: ExplanationLanguage): string {
  return `Explain this letter. Answer in ${EXPLANATION_LANGUAGES[language]} (${language}) only.`;
}

export function explainLetterSystemPrompt(language: ExplanationLanguage): string {
  const target =
    language === "de"
      ? "simple German (Einfaches Deutsch, CEFR A2-B1): short sentences, common words, no Amtsdeutsch"
      : `${EXPLANATION_LANGUAGES[language]} (language code "${language}"), plain everyday language`;

  return `
You explain an official German letter to the person who received it. Many readers are not
native German speakers and have never dealt with German authorities before.

Write the whole explanation in ${target}, including the headings. Only German terms
from the letter stay in German.

Use exactly these four headings, in this order:
${HEADINGS[language].map((heading) => `## ${heading}`).join("\n")}

Format rules:
- Plain text only. A heading line starts with "## ", a list item with "- ". Separate paragraphs
  with a blank line. No other Markdown: no bold, no tables, no links.
- Keep it short: about 150-300 words in total.

Content rules:
1. Use only what is in the letter and in the facts below it. Never invent names, amounts,
   reference numbers or dates.
2. Do not calculate dates. Mention a deadline only with the date given in the facts. If a
   deadline has no date in the facts, say that the reader should check the date in the letter.
   If a date is marked as estimated, say that it depends on when the letter arrived.
3. Under "Important words", explain 2-5 German terms from the letter that the reader will see
   again (e.g. Bescheid, Widerspruch, Aktenzeichen). Write the German term first, then the
   explanation.
4. If ignoring the letter can have consequences (fines, enforcement, losing benefits), say so
   clearly but calmly.
5. This is not legal advice. If the case looks complicated or a lot of money is at stake,
   suggest getting help (e.g. a counselling service, Verbraucherzentrale, or a lawyer).
`.trim();
}
