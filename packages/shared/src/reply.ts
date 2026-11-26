import { z } from "zod";
import { EXPLANATION_LANGUAGES, type ExplanationLanguage } from "./explanation";

/**
 * Reply drafts in German. The model writes the body; the letter frame (addresses, date,
 * subject line, reference numbers, greeting) is put together by code.
 */

export const REPLY_TYPES = [
  "OBJECTION", // Widerspruch / Einspruch
  "EXTENSION_REQUEST", // Fristverlängerung
  "SEND_DOCUMENTS", // cover letter for documents
  "INSTALLMENT_PLAN", // Ratenzahlung
  "QUESTION", // Rückfrage
] as const;
export type ReplyType = (typeof REPLY_TYPES)[number];

export const REPLY_TYPE_LABELS: Record<ReplyType, string> = {
  OBJECTION: "Objection (Widerspruch / Einspruch)",
  EXTENSION_REQUEST: "Ask for more time (Fristverlängerung)",
  SEND_DOCUMENTS: "Cover letter for documents",
  INSTALLMENT_PLAN: "Ask to pay in instalments (Ratenzahlung)",
  QUESTION: "Ask a question (Rückfrage)",
};

/** What the user should write in the notes field for each type */
export const REPLY_TYPE_HINTS: Record<ReplyType, string> = {
  OBJECTION: "Why do you disagree? Leave empty to object now and send the reasons later.",
  EXTENSION_REQUEST: "Why do you need more time, and until when?",
  SEND_DOCUMENTS: "Anything to add about the documents (optional).",
  INSTALLMENT_PLAN: "How much can you pay per month, and why can't you pay at once?",
  QUESTION: "What do you want to ask?",
};

const languageCodes = Object.keys(EXPLANATION_LANGUAGES) as [ExplanationLanguage, ...ExplanationLanguage[]];

export const CreateReplyDraftSchema = z
  .object({
    type: z.enum(REPLY_TYPES),
    /** The user's own words: reasons, questions, wishes. Any language. */
    notes: z.string().trim().max(2000).default(""),
    /** Language of the translation shown next to the German text */
    language: z.enum(languageCodes).default("en"),
  })
  .refine((body) => body.type !== "QUESTION" || body.notes.length > 0, {
    message: "Write your question in the notes.",
    path: ["notes"],
  });
export type CreateReplyDraftInput = z.input<typeof CreateReplyDraftSchema>;

/** What the model returns; code builds the full letter around it */
export const ReplyBodySchema = z.object({
  subject: z
    .string()
    .describe("Short German subject line without reference numbers, e.g. 'Widerspruch gegen den Bescheid vom 02.03.2026'"),
  paragraphs: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("Body paragraphs in formal German, without greeting and closing"),
  translation: z
    .string()
    .describe("Translation of subject and paragraphs into the user's language, so they understand what they sign"),
});
export type ReplyBody = z.infer<typeof ReplyBodySchema>;

/** Things to check before sending, decided by code; the web app puts them into words */
export type ReplyWarning =
  | { code: "NO_OBJECTION_RIGHT" }
  | { code: "OBJECTION_DEADLINE_PASSED"; date: string }
  | { code: "OBJECTION_DEADLINE"; date: string }
  | { code: "REQUEST_ONLY" }
  | { code: "FILL_PLACEHOLDERS"; placeholders: string[] };

export interface ReplyDraftDto {
  id: string;
  type: ReplyType;
  /** The complete letter in German, ready to fill in the [placeholders] and send */
  contentDe: string;
  /** Translation of the body, for the user */
  contentUserLanguage: string;
  language: ExplanationLanguage;
  notes: string;
  /** Things to check before sending, computed by code */
  warnings: ReplyWarning[];
  model: string | null;
  createdAt: string;
}
