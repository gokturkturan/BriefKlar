import type { SenderType } from "@briefklar/shared";
import { addDays, addMonths, formatLong, isIsoDate, weekday, type IsoDate } from "./calendarDate";
import { GERMAN_STATES, holidayName, isWorkingDay, nextWorkingDay, type GermanState } from "./holidays";
import { parseRelativeDeadline, type PeriodUnit, type RelativePeriod } from "./parseRelativeDeadline";

/**
 * Computes the due date of a relative deadline with the rules of German law:
 *
 * - Bekanntgabefiktion (§ 122 (2) AO, § 41 (2) VwVfG, § 37 (2) SGB X): a decision an authority
 *   sends by post counts as delivered on the 4th day after posting (3rd day before 2025).
 *   If that day is a weekend or holiday, it moves to the next working day (BFH and BSG case law).
 * - §§ 187, 188 BGB: the day of delivery is not counted. A period in weeks ends on the same
 *   weekday, a period in months on the same day number (or the last day of a shorter month).
 * - § 193 BGB (also § 108 (3) AO, § 26 (3) SGB X): if the last day is a Saturday, Sunday or
 *   public holiday, the deadline moves to the next working day.
 *
 * When information is missing, the earlier of the possible dates is chosen, so a user is never
 * told a later deadline than the real one.
 */

/** Senders whose letters are administrative acts covered by the delivery rule above */
const AUTHORITY_SENDERS: ReadonlySet<SenderType> = new Set<SenderType>([
  "FINANZAMT",
  "FAMILIENKASSE",
  "JOBCENTER",
  "AGENTUR_FUER_ARBEIT",
  "AUSLAENDERBEHOERDE",
  "BUERGERAMT",
  "KRANKENKASSE",
  "RUNDFUNKBEITRAG",
]);

/** The Postrechtsmodernisierungsgesetz extended the rule from 3 to 4 days for letters sent from 2025 on */
const FOUR_DAY_RULE_FROM: IsoDate = "2025-01-01";

export interface DeadlineInput {
  /** Deadline wording copied from the letter */
  rawText: string;
  /** Date printed on the letter (YYYY-MM-DD) */
  letterDate: IsoDate | null;
  senderType: SenderType;
  /** Day the user actually received the letter, if known */
  receivedDate?: IsoDate | null;
  /** Federal state for regional holidays; without it only nationwide holidays count */
  state?: GermanState;
}

export type DeadlineResult =
  | {
      ok: true;
      dueDate: IsoDate;
      /** true if the start of the period was assumed rather than known */
      isEstimate: boolean;
      /** Each step of the calculation in plain English, for the user */
      explanation: string[];
      period: RelativePeriod;
    }
  | { ok: false; reason: string };

const UNIT_NAMES: Record<PeriodUnit, [string, string]> = {
  DAY: ["day", "days"],
  WEEK: ["week", "weeks"],
  MONTH: ["month", "months"],
  YEAR: ["year", "years"],
};

function describePeriod({ amount, unit }: RelativePeriod): string {
  return `${amount} ${UNIT_NAMES[unit][amount === 1 ? 0 : 1]}`;
}

function addPeriod(start: IsoDate, { amount, unit }: RelativePeriod): IsoDate {
  switch (unit) {
    case "DAY":
      return addDays(start, amount);
    case "WEEK":
      return addDays(start, amount * 7);
    case "MONTH":
      return addMonths(start, amount);
    case "YEAR":
      return addMonths(start, amount * 12);
  }
}

/** "a Sunday", "Easter Monday (Ostermontag), a public holiday" */
function whyNotWorkingDay(date: IsoDate, state?: GermanState): string {
  const holiday = holidayName(date, state);
  if (holiday) return `${holiday}, a public holiday`;
  return weekday(date) === 6 ? "a Saturday" : "a Sunday";
}

interface Start {
  date: IsoDate;
  isEstimate: boolean;
  explanation: string[];
}

function startOfPeriod(input: DeadlineInput, period: RelativePeriod): Start | string {
  const { letterDate, receivedDate, senderType, state } = input;

  if (period.anchor !== "LETTER_DATE" && receivedDate) {
    return {
      date: receivedDate,
      isEstimate: false,
      explanation: [`You received the letter on ${formatLong(receivedDate)}.`],
    };
  }

  if (!letterDate) return "The letter has no date, so the deadline cannot be calculated.";

  if (period.anchor === "LETTER_DATE") {
    return {
      date: letterDate,
      isEstimate: false,
      explanation: [`The period starts with the letter date, ${formatLong(letterDate)}.`],
    };
  }

  if (period.anchor === "RECEIPT" && AUTHORITY_SENDERS.has(senderType)) {
    const days = letterDate >= FOUR_DAY_RULE_FROM ? 4 : 3;
    const deemed = addDays(letterDate, days);
    const explanation = [
      `A letter from an authority sent by post counts as delivered on the ${days === 4 ? "4th" : "3rd"} ` +
        `day after it was posted (§ 122 AO, § 41 VwVfG, § 37 SGB X). Assuming it was posted on the ` +
        `letter date, ${formatLong(letterDate)}, that is ${formatLong(deemed)}.`,
    ];
    if (isWorkingDay(deemed, state)) return { date: deemed, isEstimate: true, explanation };

    const moved = nextWorkingDay(deemed, state);
    explanation.push(
      `${formatLong(deemed)} is ${whyNotWorkingDay(deemed, state)}, so the delivery date moves to the ` +
        `next working day, ${formatLong(moved)}.`,
    );
    return { date: moved, isEstimate: true, explanation };
  }

  const explanation = [
    `The letter does not say when it reached you. To be on the safe side, the period is counted ` +
      `from the letter date, ${formatLong(letterDate)}. If you received it later, your deadline may be later.`,
  ];
  if (period.anchor === "SERVICE") {
    explanation.push(
      "If the letter came in a yellow envelope (Zustellung), the delivery date is written on the envelope.",
    );
  }
  return { date: letterDate, isEstimate: true, explanation };
}

export function computeRelativeDeadline(input: DeadlineInput): DeadlineResult {
  for (const date of [input.letterDate, input.receivedDate]) {
    if (date && !isIsoDate(date)) return { ok: false, reason: `Invalid date: ${date}` };
  }

  const parsed = parseRelativeDeadline(input.rawText);
  if (!parsed.ok) return parsed;
  const { period } = parsed;

  const start = startOfPeriod(input, period);
  if (typeof start === "string") return { ok: false, reason: start };

  const explanation = [...start.explanation];
  if (!period.anchorStated) {
    explanation.unshift("The letter does not say when the period starts, so it is assumed to start on delivery.");
  }

  const end = addPeriod(start.date, period);
  explanation.push(
    `${describePeriod(period)} after ${formatLong(start.date)} ends on ${formatLong(end)} (§§ 187, 188 BGB).`,
  );

  let dueDate = end;
  if (!isWorkingDay(end, input.state)) {
    dueDate = nextWorkingDay(end, input.state);
    explanation.push(
      `${formatLong(end)} is ${whyNotWorkingDay(end, input.state)}, so the deadline moves to the next ` +
        `working day, ${formatLong(dueDate)} (§ 193 BGB).`,
    );
  }

  if (!input.state) {
    const regional = GERMAN_STATES.filter((state) => holidayName(dueDate, state) !== null);
    if (regional.length > 0) {
      explanation.push(
        `${formatLong(dueDate)} is a public holiday in some federal states (${regional.join(", ")}). ` +
          `If you live there, the deadline is the next working day.`,
      );
    }
  }

  return { ok: true, dueDate, isEstimate: start.isEstimate, explanation, period };
}
