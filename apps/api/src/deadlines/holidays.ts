import { addDays, isWeekend, makeDate, weekday, type IsoDate } from "./calendarDate";

/**
 * Public holidays in Germany, needed for § 193 BGB: a deadline that ends on a Saturday,
 * Sunday or public holiday moves to the next working day.
 *
 * Holidays that only apply in some municipalities (e.g. Mariä Himmelfahrt in parts of
 * Bavaria, Fronleichnam in parts of Saxony and Thuringia, Augsburger Friedensfest) are not
 * included. Leaving out a holiday can only make a computed deadline earlier, never later.
 */

export const GERMAN_STATES = [
  "BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV",
  "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH",
] as const;
export type GermanState = (typeof GERMAN_STATES)[number];

/** Easter Sunday (Gregorian calendar), anonymous Gregorian algorithm by Meeus/Jones/Butcher */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDate(year, month, day);
}

/** Wednesday before 23 November (only a holiday in Saxony) */
function bussUndBettag(year: number): IsoDate {
  let date = makeDate(year, 11, 22);
  while (weekday(date) !== 3) date = addDays(date, -1);
  return date;
}

interface HolidayRule {
  name: string;
  date: (year: number) => IsoDate | null;
  /** undefined = nationwide */
  states?: readonly GermanState[];
}

const fixed = (month: number, day: number, fromYear = 0, toYear = Infinity) => (year: number) =>
  year >= fromYear && year <= toYear ? makeDate(year, month, day) : null;
const easter = (offset: number) => (year: number) => addDays(easterSunday(year), offset);
const once = (year: number, month: number, day: number) => (y: number) =>
  y === year ? makeDate(year, month, day) : null;

const RULES: HolidayRule[] = [
  { name: "New Year's Day (Neujahr)", date: fixed(1, 1) },
  { name: "Epiphany (Heilige Drei Könige)", date: fixed(1, 6), states: ["BW", "BY", "ST"] },
  { name: "International Women's Day (Frauentag)", date: fixed(3, 8, 2019), states: ["BE"] },
  { name: "International Women's Day (Frauentag)", date: fixed(3, 8, 2023), states: ["MV"] },
  { name: "Good Friday (Karfreitag)", date: easter(-2) },
  { name: "Easter Monday (Ostermontag)", date: easter(1) },
  { name: "Labour Day (Tag der Arbeit)", date: fixed(5, 1) },
  { name: "Liberation Day (Tag der Befreiung)", date: once(2020, 5, 8), states: ["BE"] },
  { name: "Liberation Day (Tag der Befreiung)", date: once(2025, 5, 8), states: ["BE"] },
  { name: "Ascension Day (Christi Himmelfahrt)", date: easter(39) },
  { name: "Whit Monday (Pfingstmontag)", date: easter(50) },
  {
    name: "Corpus Christi (Fronleichnam)",
    date: easter(60),
    states: ["BW", "BY", "HE", "NW", "RP", "SL"],
  },
  { name: "Assumption Day (Mariä Himmelfahrt)", date: fixed(8, 15), states: ["SL"] },
  { name: "World Children's Day (Weltkindertag)", date: fixed(9, 20, 2019), states: ["TH"] },
  { name: "German Unity Day (Tag der Deutschen Einheit)", date: fixed(10, 3) },
  { name: "Reformation Day (Reformationstag)", date: once(2017, 10, 31) }, // 500th anniversary
  {
    name: "Reformation Day (Reformationstag)",
    date: fixed(10, 31),
    states: ["BB", "MV", "SN", "ST", "TH"],
  },
  {
    // Made a permanent holiday in these states from 2018 on
    name: "Reformation Day (Reformationstag)",
    date: fixed(10, 31, 2018),
    states: ["HB", "HH", "NI", "SH"],
  },
  { name: "All Saints' Day (Allerheiligen)", date: fixed(11, 1), states: ["BW", "BY", "NW", "RP", "SL"] },
  { name: "Day of Repentance and Prayer (Buß- und Bettag)", date: bussUndBettag, states: ["SN"] },
  { name: "Christmas Day (1. Weihnachtstag)", date: fixed(12, 25) },
  { name: "Boxing Day (2. Weihnachtstag)", date: fixed(12, 26) },
];

/**
 * Public holidays of a year as date -> name.
 * Without a state, only nationwide holidays are returned.
 */
export function publicHolidays(year: number, state?: GermanState): Map<IsoDate, string> {
  const holidays = new Map<IsoDate, string>();
  for (const rule of RULES) {
    if (rule.states && (!state || !rule.states.includes(state))) continue;
    const date = rule.date(year);
    if (date && !holidays.has(date)) holidays.set(date, rule.name);
  }
  return holidays;
}

/** Name of the public holiday on that date, or null */
export function holidayName(date: IsoDate, state?: GermanState): string | null {
  return publicHolidays(Number(date.slice(0, 4)), state).get(date) ?? null;
}

/** Monday to Friday and not a public holiday */
export function isWorkingDay(date: IsoDate, state?: GermanState): boolean {
  return !isWeekend(date) && holidayName(date, state) === null;
}

export function nextWorkingDay(date: IsoDate, state?: GermanState): IsoDate {
  let next = date;
  while (!isWorkingDay(next, state)) next = addDays(next, 1);
  return next;
}
