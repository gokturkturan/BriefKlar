import { type LetterExtraction, LetterExtractionSchema } from "@briefklar/shared";
import type { LLMProvider } from "../llm/LLMProvider";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";
import { llm } from "../llm";

/**
 * Prompts are versioned: every stored extraction and every logged LLM call records
 * the version, so results can be compared when the prompt changes (see evals, week 6).
 */
export const EXTRACT_LETTER_PROMPT_VERSION = "extract-letter@3";

export const EXTRACT_LETTER_SYSTEM_PROMPT = `
You analyze official letters sent to people living in Germany: letters from authorities
(Finanzamt, Jobcenter, Ausländerbehörde, Bürgeramt, courts...) and formal letters from
employers, landlords and companies (banks, insurers, utilities). Your readers are often not
native German speakers.

Return JSON that follows the given schema. Rules:

1. Use only information that is in the letter. Never invent names, numbers, amounts or dates.
   If something is missing, use null or an empty list.
2. Copy reference numbers (Aktenzeichen, Steuernummer, Kundennummer, etc.) exactly as printed.
3. Deadlines:
   - "rawText" is the exact German phrase from the letter that states the time limit, long enough
     to understand it on its own, e.g. "innerhalb eines Monats nach Bekanntgabe" or
     "spätestens bis zum 31.08.2026 zurückzugeben". If it contains a date, copy the date exactly.
   - "explicitDate" is set ONLY if a calendar date is written for that deadline. Do NOT calculate
     dates from relative wording such as "within two weeks"; set explicitDate to null instead.
     Deadline calculation is done by separate software.
   - Dates use the format YYYY-MM-DD.
   - Every time limit in the letter is a deadline, including dates inside other sentences
     (e.g. "spätestens bis zum 31.08.2026 zurückgeben" is a deadline with an explicit date).
     Each required action that has a time limit must have a matching entry in "deadlines".
4. "summary": 2-4 short sentences in plain English (CEFR B1). Explain what the letter is about
   and what it means for the recipient. No legal advice.
5. "requiredActions": concrete next steps for the recipient in plain English, imperative form,
   most important first. Empty list if nothing needs to be done.
6. "urgency":
   - HIGH: a deadline, payment demand, threatened consequence (fine, enforcement, loss of benefits)
     or a short time to react.
   - MEDIUM: action needed, but without pressure or consequences mentioned.
   - LOW: purely informational, e.g. a confirmation.
7. "letterType": use BESCHEID only for decisions by an authority. A termination of a job,
   flat or contract is KUENDIGUNG, a bill from a company is INVOICE.
8. "objectionPossible": true only if the letter mentions a right to object (Rechtsbehelfsbelehrung,
   Widerspruch, Einspruch).
9. "uncertainFields": names of fields you are not confident about because the text is unclear,
   cut off or hard to read. Empty list if you are confident.
10. If the file is not an official letter, set "isOfficialLetter" to false and explain briefly in "summary".
`.trim();

export async function extractLetter(params: {
  file: Buffer;
  mimeType: string;
  documentId?: string;
  /** The evaluation runs one model at a time, without the fallback */
  provider?: LLMProvider;
  purpose?: string;
}): Promise<StructuredResult<LetterExtraction>> {
  return generateStructured({
    provider: params.provider ?? llm,
    schema: LetterExtractionSchema,
    system: EXTRACT_LETTER_SYSTEM_PROMPT,
    input: [
      { type: "file", mimeType: params.mimeType, data: params.file },
      { type: "text", text: "Analyze this letter." },
    ],
    purpose: params.purpose ?? "extract-letter",
    promptVersion: EXTRACT_LETTER_PROMPT_VERSION,
    documentId: params.documentId,
  });
}
