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

export interface SettingsDto {
  preferredLanguage: ExplanationLanguage;
  /** null: not set, only nationwide holidays are applied */
  state: GermanState | null;
}

const languageCodes = Object.keys(EXPLANATION_LANGUAGES) as [ExplanationLanguage, ...ExplanationLanguage[]];

export const UpdateSettingsSchema = z
  .object({
    preferredLanguage: z.enum(languageCodes),
    state: z.enum(GERMAN_STATES).nullable(),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD");

export const UpdateDocumentSchema = z.object({
  /** The day the letter actually arrived; null removes it */
  receivedDate: isoDate.nullable(),
});
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;
