import { z } from "zod";
import { GERMAN_STATES } from "./settings";

/**
 * How a relative deadline was calculated, step by step. The API stores the steps as data
 * (no text), so the web app can describe them in the reader's language.
 */

export const HOLIDAY_IDS = [
  "NEW_YEAR",
  "EPIPHANY",
  "WOMENS_DAY",
  "GOOD_FRIDAY",
  "EASTER_MONDAY",
  "LABOUR_DAY",
  "LIBERATION_DAY",
  "ASCENSION_DAY",
  "WHIT_MONDAY",
  "CORPUS_CHRISTI",
  "ASSUMPTION_DAY",
  "CHILDRENS_DAY",
  "GERMAN_UNITY_DAY",
  "REFORMATION_DAY",
  "ALL_SAINTS_DAY",
  "REPENTANCE_DAY",
  "CHRISTMAS_DAY",
  "BOXING_DAY",
] as const;
export type HolidayId = (typeof HOLIDAY_IDS)[number];

/** Official German names, shown next to the translated name */
export const HOLIDAY_GERMAN_NAMES: Record<HolidayId, string> = {
  NEW_YEAR: "Neujahr",
  EPIPHANY: "Heilige Drei Könige",
  WOMENS_DAY: "Frauentag",
  GOOD_FRIDAY: "Karfreitag",
  EASTER_MONDAY: "Ostermontag",
  LABOUR_DAY: "Tag der Arbeit",
  LIBERATION_DAY: "Tag der Befreiung",
  ASCENSION_DAY: "Christi Himmelfahrt",
  WHIT_MONDAY: "Pfingstmontag",
  CORPUS_CHRISTI: "Fronleichnam",
  ASSUMPTION_DAY: "Mariä Himmelfahrt",
  CHILDRENS_DAY: "Weltkindertag",
  GERMAN_UNITY_DAY: "Tag der Deutschen Einheit",
  REFORMATION_DAY: "Reformationstag",
  ALL_SAINTS_DAY: "Allerheiligen",
  REPENTANCE_DAY: "Buß- und Bettag",
  CHRISTMAS_DAY: "1. Weihnachtstag",
  BOXING_DAY: "2. Weihnachtstag",
};

export const PERIOD_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type PeriodUnit = (typeof PERIOD_UNITS)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Why a day is not a working day: a weekend day or a public holiday */
const NonWorkingDaySchema = z.enum(["SATURDAY", "SUNDAY", ...HOLIDAY_IDS]);
export type NonWorkingDay = z.infer<typeof NonWorkingDaySchema>;

export const DeadlineStepSchema = z.discriminatedUnion("type", [
  /** The wording names no start, so the period is assumed to start on delivery */
  z.object({ type: z.literal("START_ASSUMED") }),
  /** The user entered the day the letter arrived */
  z.object({ type: z.literal("RECEIVED_ON"), date: isoDate }),
  /** The wording counts from the letter date */
  z.object({ type: z.literal("STARTS_ON_LETTER_DATE"), date: isoDate }),
  /** Bekanntgabefiktion: a letter from an authority counts as delivered `days` after posting */
  z.object({ type: z.literal("DEEMED_DELIVERY"), days: z.number().int(), letterDate: isoDate, deliveryDate: isoDate }),
  /** No known delivery date: counted from the letter date to be on the safe side */
  z.object({ type: z.literal("COUNTED_FROM_LETTER_DATE"), date: isoDate }),
  /** Formal delivery (Zustellung): the date is written on the yellow envelope */
  z.object({ type: z.literal("YELLOW_ENVELOPE") }),
  /** A delivery date on a non-working day moves to the next working day */
  z.object({ type: z.literal("DELIVERY_MOVED"), date: isoDate, reason: NonWorkingDaySchema, movedTo: isoDate }),
  /** §§ 187, 188 BGB */
  z.object({
    type: z.literal("PERIOD_ENDS"),
    amount: z.number().int(),
    unit: z.enum(PERIOD_UNITS),
    start: isoDate,
    end: isoDate,
  }),
  /** § 193 BGB */
  z.object({ type: z.literal("DEADLINE_MOVED"), date: isoDate, reason: NonWorkingDaySchema, movedTo: isoDate }),
  /** The state is unknown and the due date is a holiday in some states */
  z.object({ type: z.literal("REGIONAL_HOLIDAY"), date: isoDate, states: z.array(z.enum(GERMAN_STATES)) }),
]);
export type DeadlineStep = z.infer<typeof DeadlineStepSchema>;

/** Steps read from the database; rows written by an older version are dropped */
export function parseDeadlineSteps(value: unknown): DeadlineStep[] {
  const parsed = z.array(DeadlineStepSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
