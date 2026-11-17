import { z } from "zod";

/**
 * Structured data the LLM must extract from an official letter (used from week 2 on).
 * The LLM output is validated against this schema before it is stored.
 *
 * Note: deadlines are extracted as raw text only. The actual due date is
 * computed by deterministic code, never by the LLM.
 */

export const SenderTypeSchema = z.enum([
  "FINANZAMT",
  "JOBCENTER",
  "AGENTUR_FUER_ARBEIT",
  "AUSLAENDERBEHOERDE",
  "BUERGERAMT",
  "KRANKENKASSE",
  "RUNDFUNKBEITRAG",
  "FAMILIENKASSE",
  "COURT",
  "OTHER",
]);

export const LetterTypeSchema = z.enum([
  "BESCHEID", // official decision
  "MAHNUNG", // payment reminder
  "AUFFORDERUNG", // request for action/documents
  "TERMIN", // appointment
  "INFO",
  "OTHER",
]);

export const LetterExtractionSchema = z.object({
  sender: z.object({
    name: z.string(),
    type: SenderTypeSchema,
  }),
  letterType: LetterTypeSchema,
  letterDate: z.string().nullable().describe("YYYY-MM-DD if printed on the letter"),
  subject: z.string(),
  references: z.array(z.object({ label: z.string(), value: z.string() })),
  amounts: z.array(
    z.object({ value: z.number(), currency: z.string(), purpose: z.string() }),
  ),
  deadlines: z.array(
    z.object({
      rawText: z.string().describe("Exact wording from the letter"),
      explicitDate: z.string().nullable().describe("YYYY-MM-DD only if a date is written explicitly"),
      kind: z.enum(["PAYMENT", "RESPONSE", "OBJECTION", "APPOINTMENT", "DOCUMENTS", "OTHER"]),
    }),
  ),
  requiredActions: z.array(z.string()),
  requiredDocuments: z.array(z.string()),
  objectionPossible: z.boolean(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]),
  uncertainFields: z.array(z.string()),
});

export type LetterExtraction = z.infer<typeof LetterExtractionSchema>;
