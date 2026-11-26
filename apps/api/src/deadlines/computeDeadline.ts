import type { DeadlineStep, NonWorkingDay, SenderType } from "@briefklar/shared";
import { addDays, addMonths, isIsoDate, weekday, type IsoDate } from "./calendarDate";
import { GERMAN_STATES, holidayOn, isWorkingDay, nextWorkingDay, type GermanState } from "./holidays";
import { parseRelativeDeadline, type RelativePeriod } from "./parseRelativeDeadline";

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
      /** Each step of the calculation as data; the web app puts it into words */
      steps: DeadlineStep[];
      period: RelativePeriod;
    }
  | { ok: false; reason: string };

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

/** Saturday, Sunday or the public holiday on that date */
function whyNotWorkingDay(date: IsoDate, state?: GermanState): NonWorkingDay {
  return holidayOn(date, state) ?? (weekday(date) === 6 ? "SATURDAY" : "SUNDAY");
}

interface Start {
  date: IsoDate;
  isEstimate: boolean;
  steps: DeadlineStep[];
}

function startOfPeriod(input: DeadlineInput, period: RelativePeriod): Start | string {
  const { letterDate, receivedDate, senderType, state } = input;

  if (period.anchor !== "LETTER_DATE" && receivedDate) {
    return {
      date: receivedDate,
      isEstimate: false,
      steps: [{ type: "RECEIVED_ON", date: receivedDate }],
    };
  }

  if (!letterDate) return "The letter has no date, so the deadline cannot be calculated.";

  if (period.anchor === "LETTER_DATE") {
    return {
      date: letterDate,
      isEstimate: false,
      steps: [{ type: "STARTS_ON_LETTER_DATE", date: letterDate }],
    };
  }

  if (period.anchor === "RECEIPT" && AUTHORITY_SENDERS.has(senderType)) {
    const days = letterDate >= FOUR_DAY_RULE_FROM ? 4 : 3;
    const deemed = addDays(letterDate, days);
    const steps: DeadlineStep[] = [{ type: "DEEMED_DELIVERY", days, letterDate, deliveryDate: deemed }];
    if (isWorkingDay(deemed, state)) return { date: deemed, isEstimate: true, steps };

    const moved = nextWorkingDay(deemed, state);
    steps.push({ type: "DELIVERY_MOVED", date: deemed, reason: whyNotWorkingDay(deemed, state), movedTo: moved });
    return { date: moved, isEstimate: true, steps };
  }

  // No known delivery date: counting from the letter date gives the earliest possible deadline
  const steps: DeadlineStep[] = [{ type: "COUNTED_FROM_LETTER_DATE", date: letterDate }];
  if (period.anchor === "SERVICE") steps.push({ type: "YELLOW_ENVELOPE" });
  return { date: letterDate, isEstimate: true, steps };
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

  const steps = [...start.steps];
  if (!period.anchorStated) steps.unshift({ type: "START_ASSUMED" });

  const end = addPeriod(start.date, period);
  steps.push({ type: "PERIOD_ENDS", amount: period.amount, unit: period.unit, start: start.date, end });

  let dueDate = end;
  if (!isWorkingDay(end, input.state)) {
    dueDate = nextWorkingDay(end, input.state);
    steps.push({ type: "DEADLINE_MOVED", date: end, reason: whyNotWorkingDay(end, input.state), movedTo: dueDate });
  }

  if (!input.state) {
    const regional = GERMAN_STATES.filter((state) => holidayOn(dueDate, state) !== null);
    if (regional.length > 0) steps.push({ type: "REGIONAL_HOLIDAY", date: dueDate, states: regional });
  }

  return { ok: true, dueDate, isEstimate: start.isEstimate, steps, period };
}
