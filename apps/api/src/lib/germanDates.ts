/**
 * Deterministic date handling. The LLM is never trusted with dates on its own:
 * a deadline date is only accepted if it literally appears in the letter's wording.
 */

const GERMAN_DATE = /\b(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\b/g;

function isValidDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** All dates written as DD.MM.YYYY in a text, as YYYY-MM-DD strings. */
export function findGermanDates(text: string): string[] {
  const dates: string[] = [];
  for (const match of text.matchAll(GERMAN_DATE)) {
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (isValidDate(year, month, day)) {
      dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}

/**
 * Picks the due date of a deadline:
 * - one date in the wording            -> that date (the model's own value is ignored)
 * - several dates in the wording       -> the model's choice, but only if it is one of them
 * - no date in the wording             -> null (relative deadline, computed elsewhere)
 */
export function resolveExplicitDate(rawText: string, modelDate: string | null): string | null {
  const dates = findGermanDates(rawText);
  if (dates.length === 1) return dates[0]!;
  if (dates.length > 1 && modelDate && dates.includes(modelDate)) return modelDate;
  return null;
}
