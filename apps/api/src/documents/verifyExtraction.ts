import { z } from "zod";
import type { AgentIssue, LetterExtraction } from "@briefklar/shared";
import type { LLMProvider } from "../llm/LLMProvider";
import { generateStructured, type StructuredResult } from "../llm/generateStructured";

export const VERIFY_EXTRACTION_PROMPT_VERSION = "verify-extraction@1";

/** The longest evidence an issue keeps (AgentIssueSchema) */
const MAX_EVIDENCE_LENGTH = 300;

export const VERIFY_EXTRACTION_SYSTEM_PROMPT = `
You check the analysis of an official German letter. Another model read the letter and wrote the
analysis as JSON. Compare every checkable fact in the analysis with the letter and report the
errors you can prove.

Check:
- isOfficialLetter, sender.type, letterType and letterDate.
- references: every reference number must be in the letter and copied exactly (same characters).
  A reference number of the letter that is missing is an error.
- amounts: every value must be in the letter (1.240,00 € is 1240). A missing amount that the
  recipient has to pay or receives is an error.
- deadlines: "rawText" must be wording from the letter. "explicitDate" may only be set when that
  date is written in the letter for this deadline; it must be null for relative wording such as
  "innerhalb eines Monats". Every time limit of the letter (payment, reply, objection,
  appointment, documents) must have a deadline. A wrong "kind" is an error.
- objectionPossible: true only if the letter mentions Widerspruch, Einspruch or a
  Rechtsbehelfsbelehrung.
- summary and requiredActions: only report statements that contradict the letter or invent facts.
  Do not report style, length or wording.

Rules:
1. Report only errors you can prove with the letter. When the analysis is a reasonable reading,
   it is correct. Do not report urgency, uncertainFields or letterLanguage.
2. "field" is the path in the analysis, e.g. "amounts[0].value", "deadlines[1].explicitDate",
   "references" or "deadlines" for something missing.
3. "problem" says in one sentence what is wrong and what the letter says instead.
4. "evidence" quotes the sentence of the letter that shows it, word for word (at most 250
   characters). For a value that is not in the letter at all, write "not in the letter".
5. If the analysis is correct, return an empty list of issues.
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
  const issues = result.data.issues.map((issue) => ({
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
