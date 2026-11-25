import {
  EXPLANATION_LANGUAGES,
  type ExplanationLanguage,
  type LetterExtraction,
  type ReplyType,
} from "@briefklar/shared";
import { objectionTerm } from "../replies/composeReplyLetter";

export const REPLY_DRAFT_PROMPT_VERSION = "reply-draft@1";

export const REPLY_DRAFT_SYSTEM_PROMPT = `
You write the body of a reply to an official German letter, on behalf of the recipient.
The recipient is often not a native German speaker. Software adds the addresses, date,
reference numbers, greeting ("Sehr geehrte Damen und Herren,") and closing
("Mit freundlichen Grüßen"), so leave all of these out.

Rules:
1. Formal, polite, factual German (Sie-Form). Short sentences. No legal threats, no emotions.
2. Use only facts from the letter analysis and the user's notes. Never invent reasons,
   amounts, dates or circumstances. Where the user must add something, write a short
   placeholder in square brackets, e.g. [monatlicher Betrag] or [neues Datum].
3. The user's notes may be in any language: use their content, but write German.
4. Do not repeat reference numbers or the subject line in the paragraphs.
5. "subject": a short German subject line without reference numbers.
6. "paragraphs": 1-5 paragraphs.
7. "translation": translate the subject and all paragraphs into the user's language, so the
   user understands exactly what they are signing. Keep the [placeholders] in German.
`.trim();

function instructions(type: ReplyType, extraction: LetterExtraction): string {
  switch (type) {
    case "OBJECTION": {
      const term = objectionTerm(extraction.sender.type);
      return [
        `Write a ${term} against the decision. Use the word "${term}".`,
        `Start with "hiermit lege ich ${term} gegen ... ein" and name the letter by its date and subject.`,
        `If the notes give reasons, state them briefly. If not, write that the reasons will follow`,
        `("Die Begründung reiche ich nach.").`,
        `Ask for a written confirmation of receipt.`,
      ].join(" ");
    }
    case "EXTENSION_REQUEST":
      return (
        "Ask politely for more time to respond (Fristverlängerung). Give the reason from the notes, " +
        "or [Grund] if there is none. Propose a new date from the notes, or [neues Datum]."
      );
    case "SEND_DOCUMENTS":
      return (
        "Write a short cover letter: the requested documents are enclosed. Do not list them, " +
        "software adds the list of attachments. Add anything from the notes."
      );
    case "INSTALLMENT_PLAN":
      return (
        "Ask to pay the amount in monthly instalments (Ratenzahlung). Name the amount from the " +
        "analysis. Use the monthly amount and reason from the notes, or [monatlicher Betrag] and " +
        "[Grund]. Offer to provide proof of income if needed."
      );
    case "QUESTION":
      return "Ask the question from the notes clearly and briefly. Ask for a written answer.";
  }
}

export function replyDraftInput(params: {
  type: ReplyType;
  extraction: LetterExtraction;
  notes: string;
  language: ExplanationLanguage;
}): string {
  const { type, extraction, notes, language } = params;
  return [
    `Task: ${instructions(type, extraction)}`,
    "",
    `User's language for "translation": ${EXPLANATION_LANGUAGES[language]} (${language}).`,
    "",
    "User's notes (their own words, may be empty):",
    notes ? `"""${notes}"""` : "(none)",
    "",
    "Analysis of the letter they are replying to:",
    JSON.stringify(
      {
        sender: extraction.sender,
        letterType: extraction.letterType,
        letterDate: extraction.letterDate,
        subject: extraction.subject,
        summary: extraction.summary,
        amounts: extraction.amounts,
        requiredDocuments: extraction.requiredDocuments,
      },
      null,
      2,
    ),
  ].join("\n");
}
