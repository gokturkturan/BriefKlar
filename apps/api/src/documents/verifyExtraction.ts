import { z } from "zod";
import type { AgentIssue, LetterExtraction } from "@briefklar/shared";
import type { LLMProvider } from "../llm/LLMProvider";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";

export const VERIFY_EXTRACTION_PROMPT_VERSION = "verify-extraction@2";

/** The longest evidence an issue keeps (AgentIssueSchema) */
const MAX_EVIDENCE_LENGTH = 300;

/**
 * The facts the verifier checks. Wording (summary, requiredActions) has no single right answer,
 * so a dispute about it would only cost a correction round; issues about other fields are dropped.
 */
export const CHECKED_FIELDS = [
  "isOfficialLetter",
  "sender",
  "letterType",
  "letterDate",
  "references",
  "amounts",
  "deadlines",
  "objectionPossible",
] as const;

export const VERIFY_EXTRACTION_SYSTEM_PROMPT = `
You check the analysis of an official German letter. Another model read the letter and wrote the
analysis as JSON. Compare the facts below with the letter and report only clear errors: a value
that contradicts the letter, a value the letter does not contain, or a fact of the letter that is
missing. Most analyses are correct; an empty list is the normal answer.

Check only these fields:
- isOfficialLetter: true for any formal letter from an authority, court, employer, landlord or
  company (a bill from a phone company is an official letter); false only for private letters,
  advertising and files that are no letter.
- sender.type, one of: FINANZAMT, JOBCENTER, AGENTUR_FUER_ARBEIT, AUSLAENDERBEHOERDE, BUERGERAMT,
  KRANKENKASSE (any statutory or private health insurer), RUNDFUNKBEITRAG (the ARD ZDF
  Deutschlandradio Beitragsservice), FAMILIENKASSE, COURT, EMPLOYER, LANDLORD (also a property
  management), COMPANY (bank, insurer, telecom, utility...), OTHER. Report it only when another
  of these types fits the sender clearly better.
- letterType: BESCHEID is a decision by an authority or court, MAHNUNG a payment reminder,
  AUFFORDERUNG a request for action or documents, TERMIN an appointment, KUENDIGUNG a
  termination, INVOICE a bill from a company. When two types fit (a court's Mahnbescheid is a
  decision and a payment demand), accept either.
- letterDate: the date printed on the letter.
- references: every reference number must be in the letter, copied exactly. A reference number
  of the letter that is missing is an error.
- amounts: every value must be in the letter (1.240,00 € is 1240). An amount the recipient must
  pay now or receives that is missing is an error. A fee that may arise later (late payment
  surcharge, costs of enforcement) does not have to be listed.
- deadlines: "rawText" must be wording from the letter. "explicitDate" may only be set when that
  date is written in the letter for this deadline; it must be null for relative wording such as
  "innerhalb eines Monats". Every time limit of the letter (payment, reply, objection,
  appointment, documents) must have a deadline. A clearly wrong "kind" is an error.
- objectionPossible: must be true when the letter mentions Widerspruch, Einspruch or a
  Rechtsbehelfsbelehrung, and false when the letter gives no way to object at all. Other ways to
  dispute (Einwendungen against a bill) allow either value.

Do not check or report the summary, requiredActions, requiredDocuments, urgency, subject,
uncertainFields or letterLanguage. Do not report a reasonable reading or a different wording.

Each issue:
1. "field" is the path in the analysis, e.g. "amounts[0].value", "deadlines[1].explicitDate",
   "references" or "deadlines" for something missing.
2. "problem" says in one sentence what is wrong and what the letter says instead.
3. "evidence" quotes the sentence of the letter that shows it, word for word (at most 250
   characters). For a value that is not in the letter at all, write "not in the letter".
`.trim();

const VerificationSchema = z.object({
  issues: z.array(
    z.object({
      field: z.string().min(1).describe('Path in the analysis, e.g. "amounts[0].value"'),
      problem: z.string().min(1).describe("What is wrong and what the letter says instead"),
      evidence: z.string().describe('The sentence of the letter that shows it, or "not in the letter"'),
    }),
  ),
});

export interface Verification {
  /** Empty when the analysis matches the letter */
  issues: AgentIssue[];
}

/**
 * Asks a second model (another one than the extractor's, so the same misreading is not confirmed)
 * to compare the analysis with the letter. The letter goes as the original file, so a scan is
 * read again instead of trusting the first reading.
 */
export async function verifyExtraction(params: {
  provider: LLMProvider;
  file: Buffer;
  mimeType: string;
  extraction: LetterExtraction;
  documentId?: string;
  purpose?: string;
}): Promise<StructuredResult<Verification>> {
  const result = await generateStructured({
    provider: params.provider,
    schema: VerificationSchema,
    system: VERIFY_EXTRACTION_SYSTEM_PROMPT,
    input: [
      { type: "file", mimeType: params.mimeType, data: params.file },
      {
        type: "text",
        text: `The analysis to check:\n${JSON.stringify(params.extraction, null, 2)}\n\nCheck it against the letter.`,
      },
    ],
    purpose: params.purpose ?? "verify-letter",
    promptVersion: VERIFY_EXTRACTION_PROMPT_VERSION,
    documentId: params.documentId,
  });
  const checked = new Set<string>(CHECKED_FIELDS);
  const issues = result.data.issues
    .filter((issue) => checked.has(topLevelField(issue.field)))
    .map((issue) => ({
      field: issue.field.trim(),
      problem: issue.problem.trim(),
      evidence: issue.evidence.trim().slice(0, MAX_EVIDENCE_LENGTH),
    }));
  return { ...result, data: { issues } };
}

/** "amounts[0].value" → "amounts": the names uncertainFields uses */
export function topLevelField(path: string): string {
  return path.split(/[.[]/)[0].trim();
}

/**
 * Marks the fields the verifier still disputes after the revision as uncertain, so the page
 * tells the user to check them in the letter. Returns a new analysis.
 */
export function markUncertain(extraction: LetterExtraction, issues: AgentIssue[]): LetterExtraction {
  const fields = new Set(extraction.uncertainFields);
  for (const issue of issues) {
    const field = topLevelField(issue.field);
    if (field) fields.add(field);
  }
  return { ...extraction, uncertainFields: [...fields] };
}
