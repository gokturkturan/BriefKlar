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
  "EMPLOYER",
  "LANDLORD",
  "COMPANY", // bank, insurer, telecom, utility...
  "OTHER",
]);

export const LetterTypeSchema = z.enum([
  "BESCHEID", // official decision
  "MAHNUNG", // payment reminder
  "AUFFORDERUNG", // request for action/documents
  "TERMIN", // appointment
  "KUENDIGUNG", // termination of a contract (job, flat, subscription...)
  "INVOICE", // bill from a company
  "INFO",
  "OTHER",
]);

export const LetterExtractionSchema = z.object({
  isOfficialLetter: z
    .boolean()
    .describe("false if the file is not a letter from an authority, company or institution"),
  letterLanguage: z.string().describe("ISO 639-1 code of the letter's language, e.g. de"),
  summary: z
    .string()
    .describe("2-4 short sentences in plain English (B1 level): what the letter is about and what it means for the recipient"),
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
  uncertainFields: z
    .array(z.string())
    .describe("Field names you are not sure about, e.g. deadlines or amounts"),
});

export type LetterExtraction = z.infer<typeof LetterExtractionSchema>;
export type SenderType = z.infer<typeof SenderTypeSchema>;
export type LetterType = z.infer<typeof LetterTypeSchema>;
export type DeadlineKind = LetterExtraction["deadlines"][number]["kind"];
export type Urgency = LetterExtraction["urgency"];

export const SENDER_TYPE_LABELS: Record<SenderType, string> = {
  FINANZAMT: "Tax office (Finanzamt)",
  JOBCENTER: "Jobcenter",
  AGENTUR_FUER_ARBEIT: "Employment agency (Agentur für Arbeit)",
  AUSLAENDERBEHOERDE: "Immigration office (Ausländerbehörde)",
  BUERGERAMT: "Citizens' office (Bürgeramt)",
  KRANKENKASSE: "Health insurance (Krankenkasse)",
  RUNDFUNKBEITRAG: "Broadcasting fee (Rundfunkbeitrag)",
  FAMILIENKASSE: "Family benefits office (Familienkasse)",
  COURT: "Court",
  EMPLOYER: "Employer",
  LANDLORD: "Landlord",
  COMPANY: "Company",
  OTHER: "Other",
};

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  BESCHEID: "Official decision (Bescheid)",
  MAHNUNG: "Payment reminder (Mahnung)",
  AUFFORDERUNG: "Request for action",
  TERMIN: "Appointment",
  KUENDIGUNG: "Termination of contract (Kündigung)",
  INVOICE: "Invoice",
  INFO: "Information / confirmation",
  OTHER: "Other",
};

export const DEADLINE_KIND_LABELS: Record<DeadlineKind, string> = {
  PAYMENT: "Payment",
  RESPONSE: "Reply",
  OBJECTION: "Objection (Widerspruch)",
  APPOINTMENT: "Appointment",
  DOCUMENTS: "Send documents",
  OTHER: "Other",
};
