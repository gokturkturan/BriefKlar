/**
 * Calendar dates as "YYYY-MM-DD" strings. Deadlines are whole days without a time or
 * time zone, so all arithmetic runs in UTC to avoid daylight-saving surprises.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): Date {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Invalid date: ${value}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export function isIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function makeDate(year: number, month: number, day: number): IsoDate {
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Same day number `months` later. If that month is shorter, the last day of the month
 * is used (31 January + 1 month = 28/29 February), as § 188 (3) BGB requires.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = parseIsoDate(date);
  const totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(year, monthIndex));
  return toIsoDate(new Date(Date.UTC(year, monthIndex, day)));
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: IsoDate): number {
  return parseIsoDate(date).getUTCDay();
}

export function isWeekend(date: IsoDate): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

/** Today's date in Germany, whatever the server's time zone */
export function todayInGermany(now = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now);
}
