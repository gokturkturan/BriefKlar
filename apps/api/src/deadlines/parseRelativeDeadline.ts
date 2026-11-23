/**
 * Reads the time limit out of German deadline wording such as
 * "innerhalb eines Monats nach Bekanntgabe" or "binnen 14 Tagen nach Erhalt dieses Schreibens".
 *
 * The parser is deliberately strict: when the wording is unclear, it returns a reason instead
 * of a guess, and the letter is shown without a computed date.
 */

export type PeriodUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

/**
 * What the period is counted from:
 * - RECEIPT: Bekanntgabe, Zugang, Erhalt (also assumed when the wording names no start)
 * - SERVICE: formal delivery (Zustellung), its date is written on the envelope
 * - LETTER_DATE: the date printed on the letter (Rechnungsdatum, Datum dieses Schreibens)
 */
export type PeriodAnchor = "RECEIPT" | "SERVICE" | "LETTER_DATE";

export interface RelativePeriod {
  amount: number;
  unit: PeriodUnit;
  anchor: PeriodAnchor;
  /** false if the wording names no start event and RECEIPT was assumed */
  anchorStated: boolean;
}

export type ParseResult =
  | { ok: true; period: RelativePeriod }
  | { ok: false; reason: string };

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eines: 1,
  zwei: 2, drei: 3, vier: 4, "fünf": 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8,
  neun: 9, zehn: 10, elf: 11, "zwölf": 12, zwoelf: 12, vierzehn: 14, zwanzig: 20,
  einundzwanzig: 21, achtundzwanzig: 28, "dreißig": 30, dreissig: 30,
};

const NUMBER = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;
const UNIT = "(tag|tage|tagen|tages|kalendertag|kalendertage|kalendertagen|woche|wochen|monat|monate|monaten|monats|jahr|jahre|jahren|jahres|jahrs)";

// "zwei (2) Wochen" is common in contracts, the digits in brackets are optional
const DURATION = new RegExp(`(?<![\\p{L}\\d])${NUMBER}(?:\\s*\\(\\d{1,3}\\))?\\s+${UNIT}(?![\\p{L}])`, "giu");
const FRIST_WORD = /(?<![\p{L}])(monatsfrist|wochenfrist|jahresfrist)(?![\p{L}])/giu;

const BUSINESS_DAYS = /(werk|arbeits|bankarbeits|geschäfts)tag/iu;
const IMMEDIATE = /\b(unverzüglich|sofort|umgehend)\b/iu;

const LETTER_DATE_ANCHOR =
  /(rechnungsdatum|briefdatum|ausstellungsdatum|bescheiddatum|datum\s+(dieses|des|der|unseres)\s+(schreibens|briefes|bescheides|bescheids|rechnung|mahnung))/iu;
const SERVICE_ANCHOR = /zustellung/iu;
const RECEIPT_ANCHOR = /(bekanntgabe|zugang|erhalt|eingang\s+(dieses|des)\s+(schreibens|briefes|bescheides|bescheids))/iu;

function unitOf(word: string): PeriodUnit {
  const w = word.toLowerCase();
  if (w.startsWith("woche")) return "WEEK";
  if (w.startsWith("monat")) return "MONTH";
  if (w.startsWith("jahr")) return "YEAR";
  return "DAY";
}

function amountOf(word: string): number {
  const w = word.toLowerCase();
  return /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w]!;
}

interface Found {
  amount: number;
  unit: PeriodUnit;
  end: number;
}

function findDurations(text: string): Found[] {
  const found: Found[] = [];
  for (const m of text.matchAll(DURATION)) {
    found.push({ amount: amountOf(m[1]!), unit: unitOf(m[2]!), end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(FRIST_WORD)) {
    const unit: PeriodUnit = m[1]!.toLowerCase().startsWith("monat")
      ? "MONTH"
      : m[1]!.toLowerCase().startsWith("woche")
        ? "WEEK"
        : "YEAR";
    found.push({ amount: 1, unit, end: m.index! + m[0].length });
  }
  return found;
}

function anchorOf(text: string): { anchor: PeriodAnchor; anchorStated: boolean } {
  // The letter date is checked first: "14 Tage nach Rechnungsdatum" must not count from receipt
  if (LETTER_DATE_ANCHOR.test(text)) return { anchor: "LETTER_DATE", anchorStated: true };
  if (SERVICE_ANCHOR.test(text)) return { anchor: "SERVICE", anchorStated: true };
  if (RECEIPT_ANCHOR.test(text)) return { anchor: "RECEIPT", anchorStated: true };
  return { anchor: "RECEIPT", anchorStated: false };
}

export function parseRelativeDeadline(rawText: string): ParseResult {
  const text = rawText.replace(/\s+/g, " ").trim();

  if (BUSINESS_DAYS.test(text)) {
    return { ok: false, reason: "Periods in working days are not supported yet." };
  }

  const durations = findDurations(text);
  if (durations.length === 0) {
    return IMMEDIATE.test(text)
      ? { ok: false, reason: "The letter asks you to act immediately, without a fixed period." }
      : { ok: false, reason: "No time period found in the wording." };
  }

  const distinct = new Set(durations.map((d) => `${d.amount}${d.unit}`));
  if (distinct.size > 1) {
    return { ok: false, reason: "The wording contains more than one time period." };
  }

  // "eine Woche vor dem Termin" counts backwards from an event the letter does not date
  const first = durations[0]!;
  if (/^\s*vor\b/iu.test(text.slice(first.end))) {
    return { ok: false, reason: "Periods that end before an event are not supported." };
  }
  if (first.amount <= 0) {
    return { ok: false, reason: "The time period is zero." };
  }

  return { ok: true, period: { amount: first.amount, unit: first.unit, ...anchorOf(text) } };
}
