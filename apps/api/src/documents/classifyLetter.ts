import { IntakeResultSchema, type IntakeResult, type LetterExtraction } from "@briefklar/shared";
import { llm } from "../llm";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";
import type { LLMProvider } from "../llm/LLMProvider";

export const CLASSIFY_LETTER_PROMPT_VERSION = "classify-letter@1";

export const CLASSIFY_LETTER_SYSTEM_PROMPT = `
You sort uploads for an app that explains official letters to people living in Germany. Look at
the upload and decide four things. Do not analyse the letter in detail: another step does that.

1. "isOfficialLetter": true for any letter or notice from an authority (Finanzamt, Jobcenter,
   Ausländerbehörde, Familienkasse, Krankenkasse, Rundfunkbeitrag, a court...), and for formal
   letters from an employer, landlord or company (invoices, reminders, contracts, terminations,
   bank and insurance letters). False only when it clearly is none of these: a private letter
   or invitation from friends or family, a greeting card, advertising, a newspaper article, a
   photo without a document. When in doubt, answer true.
2. "letterType": your best guess of the kind of letter. Use BESCHEID only for decisions by an
   authority, KUENDIGUNG for a termination, INVOICE for a company's bill. OTHER when it is not an
   official letter.
3. "language": ISO 639-1 code of the main language of the document.
4. "scanQuality": how well the text can be read.
   - GOOD: all text is readable (a text file or a clean PDF is always GOOD).
   - POOR: some parts are blurry, dark, cut off, skewed or covered, but most of the text is readable.
   - UNREADABLE: the text cannot be read, e.g. a very blurry, dark or tiny photo.

"senderName" is the sender as printed, or null. "summary" says in 1-2 short sentences of plain
English (CEFR B1) what the document is, e.g. "A private invitation to a birthday party."
`.trim();

export async function classifyLetter(params: {
  file: Buffer;
  mimeType: string;
  documentId?: string;
  /** The evaluation runs one model at a time, without the fallback */
  provider?: LLMProvider;
  purpose?: string;
}): Promise<StructuredResult<IntakeResult>> {
  return generateStructured({
    provider: params.provider ?? llm,
    schema: IntakeResultSchema,
    system: CLASSIFY_LETTER_SYSTEM_PROMPT,
    input: [
      { type: "file", mimeType: params.mimeType, data: params.file },
      { type: "text", text: "Sort this upload." },
    ],
    purpose: params.purpose ?? "classify-letter",
    promptVersion: CLASSIFY_LETTER_PROMPT_VERSION,
    documentId: params.documentId,
  });
}

/**
 * The analysis stored for a document that is not an official letter: what the intake agent saw,
 * without facts, tasks or deadlines. The page shows it with a note and offers the full analysis.
 */
export function screenedOutAnalysis(intake: IntakeResult): LetterExtraction {
  return {
    isOfficialLetter: false,
    letterLanguage: intake.language,
    summary: intake.summary,
    sender: { name: intake.senderName ?? "", type: "OTHER" },
    letterType: "OTHER",
    letterDate: null,
    subject: "",
    references: [],
    amounts: [],
    deadlines: [],
    requiredActions: [],
    requiredDocuments: [],
    objectionPossible: false,
    urgency: "LOW",
    uncertainFields: [],
  };
}

/** True for an analysis stored by the intake agent instead of the extractor */
export function isScreenedOut(promptVersion: string): boolean {
  return promptVersion.startsWith("classify-letter@");
}
