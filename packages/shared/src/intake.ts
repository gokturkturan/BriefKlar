import { z } from "zod";
import { LetterTypeSchema } from "./letter";

/**
 * What the intake agent decides about an upload before the letter is analysed: whether it is an
 * official letter at all, what kind of letter, in which language, and whether the scan or photo
 * can be read. A document that is not an official letter skips the full analysis.
 */

/** How well the text of the upload can be read */
export const SCAN_QUALITIES = ["GOOD", "POOR", "UNREADABLE"] as const;
export const ScanQualitySchema = z.enum(SCAN_QUALITIES);
export type ScanQuality = z.infer<typeof ScanQualitySchema>;

export const IntakeResultSchema = z.object({
  isOfficialLetter: z
    .boolean()
    .describe("true for any letter from an authority, court, employer, landlord or company; false only when it clearly is none"),
  letterType: LetterTypeSchema.describe("Best guess of the kind of letter; OTHER when it is not an official letter"),
  language: z.string().describe("ISO 639-1 code of the document's main language, e.g. de"),
  scanQuality: ScanQualitySchema.describe(
    "GOOD: all text is readable. POOR: parts are blurry, cut off, dark or skewed. UNREADABLE: the text cannot be read",
  ),
  senderName: z.string().nullable().describe("Who wrote the document, if it says; null otherwise"),
  summary: z.string().describe("1-2 short sentences in plain English: what this document is"),
});
export type IntakeResult = z.infer<typeof IntakeResultSchema>;
