import { z } from "zod";
import { EXPLANATION_LANGUAGES, type ExplanationLanguage } from "./explanation";

/** The 16 federal states; regional public holidays move deadlines (§ 193 BGB) */
export const GERMAN_STATES = [
  "BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV",
  "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
] as const;
export type GermanState = (typeof GERMAN_STATES)[number];

export const GERMAN_STATE_NAMES: Record<GermanState, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

export function isGermanState(value: unknown): value is GermanState {
  return typeof value === "string" && (GERMAN_STATES as readonly string[]).includes(value);
}

/** Days after upload when letters are deleted automatically (GDPR storage limitation) */
export const RETENTION_PERIODS = [30, 90, 180, 365] as const;
export type RetentionPeriod = (typeof RETENTION_PERIODS)[number];

export function isRetentionPeriod(value: unknown): value is RetentionPeriod {
  return (RETENTION_PERIODS as readonly unknown[]).includes(value);
}

export interface SettingsDto {
  preferredLanguage: ExplanationLanguage;
  /** null: not set, only nationwide holidays are applied */
  state: GermanState | null;
  /** null: letters are kept until the user deletes them */
  retentionDays: RetentionPeriod | null;
}

const languageCodes = Object.keys(EXPLANATION_LANGUAGES) as [ExplanationLanguage, ...ExplanationLanguage[]];

export const UpdateSettingsSchema = z
  .object({
    preferredLanguage: z.enum(languageCodes),
    state: z.enum(GERMAN_STATES).nullable(),
    retentionDays: z.literal(RETENTION_PERIODS).nullable(),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD");

export const UpdateDocumentSchema = z.object({
  /** The day the letter actually arrived; null removes it */
  receivedDate: isoDate.nullable(),
});
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

/** The answer to the question card of a letter; null = the user does not know or skips it */
export const AnswerQuestionSchema = z.discriminatedUnion("question", [
  z.object({ question: z.literal("RECEIVED_DATE"), receivedDate: isoDate.nullable() }),
  z.object({ question: z.literal("FEDERAL_STATE"), state: z.enum(GERMAN_STATES).nullable() }),
]);
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>;
