import type { AgentIssue, LetterExtraction, ReplyBody } from "@briefklar/shared";

/**
 * Numbers in a reply draft (amounts, dates, reference numbers, periods) must come from the letter
 * or from the user. This file finds them without a model: every number of the draft is compared
 * with the numbers of its sources, in each form the same value can be written in
 * (1.240,00 € = 1240 = 1,240.00; 02.03.2026 = 2. März 2026 = 2026-03-02).
 */

/** What replaces a number of a draft that no source contains */
export const UNSUPPORTED_PLACEHOLDER = "[Angabe prüfen]";

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  jänner: 1,
  februar: 2,
  märz: 3,
  maerz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const TEXT_DATE = new RegExp(`\\b(\\d{1,2})\\.\\s*(${Object.keys(GERMAN_MONTHS).join("|")})\\s+(\\d{4})\\b`, "giu");
const NUMBER = /\d(?:[\d.,/-]*\d)?/g;
const PLACEHOLDER = /\[[^\]\n]*\]/g;

/** A number of a text, where it is and the values it can stand for */
export interface FactToken {
  text: string;
  start: number;
  end: number;
  keys: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

function dateKey(day: number, month: number, year: number): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `D:${year}-${pad(month)}-${pad(day)}`;
}

const numberKey = (value: number) => (Number.isFinite(value) ? `N:${Number(value.toFixed(2))}` : null);

/** The values a number written like `token` can mean */
function keysOf(token: string): string[] {
  const keys = new Set<string>([`R:${token.replace(/\D/g, "")}`]);
  const add = (key: string | null) => key && keys.add(key);

  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/.exec(token);
  if (m) {
    const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    add(dateKey(Number(m[1]), Number(m[2]), year));
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
  if (m) add(dateKey(Number(m[3]), Number(m[2]), Number(m[1])));
  // A day without its year, as in "bis zum 15.04."
  m = /^(\d{1,2})\.(\d{1,2})$/.exec(token);
  if (m) add(`M:${pad(Number(m[2]))}-${pad(Number(m[1]))}`);

  // German (1.240,50) and English (1,240.50) amounts
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$|^\d+,\d+$/.test(token)) {
    add(numberKey(Number(token.replace(/\./g, "").replace(",", "."))));
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d+\.\d+$/.test(token)) add(numberKey(Number(token.replace(/,/g, ""))));
  if (/^\d+$/.test(token)) add(numberKey(Number(token)));
  return [...keys];
}

/** Hides a match so the next pattern does not find it again, keeping the positions */
const blank = (text: string, start: number, end: number) =>
  text.slice(0, start) + " ".repeat(end - start) + text.slice(end);

/**
 * The numbers of a text with two digits or more (a single digit, as in "2 Wochen", says too
 * little to check). Text in [square brackets] is a placeholder the user fills in and is skipped.
 */
export function factTokens(text: string): FactToken[] {
  const tokens: FactToken[] = [];
  let rest = text.replace(PLACEHOLDER, (match) => " ".repeat(match.length));

  for (const m of rest.matchAll(TEXT_DATE)) {
    const month = GERMAN_MONTHS[m[2]!.toLowerCase()]!;
    const key = dateKey(Number(m[1]), month, Number(m[3]));
    const start = m.index;
    const end = start + m[0].length;
    tokens.push({ text: m[0], start, end, keys: key ? [key] : [] });
    rest = blank(rest, start, end);
  }

  for (const m of rest.matchAll(NUMBER)) {
    const token = m[0];
    if (token.replace(/\D/g, "").length < 2) continue;
    tokens.push({ text: token, start: m.index, end: m.index + token.length, keys: keysOf(token) });
  }
  return tokens.sort((a, b) => a.start - b.start);
}

/**
 * Every value the sources contain, in all its forms. The parts of a date count on their own
 * too, so "das Jahr 2025" is backed by a letter dated 15.03.2025.
 */
export function factKeys(sources: string[]): Set<string> {
  const keys = new Set<string>();
  for (const source of sources) {
    for (const token of factTokens(source)) {
      for (const key of token.keys) {
        keys.add(key);
        const date = /^D:(\d{4})-(\d{2})-(\d{2})$/.exec(key);
        if (!date) continue;
        for (const part of date.slice(1)) keys.add(`N:${Number(part)}`);
        keys.add(`M:${date[2]}-${date[3]}`);
      }
    }
  }
  return keys;
}

/** The texts a draft may take its numbers from: the analysis of the letter, the user's notes and today */
export function replySources(params: { extraction: LetterExtraction; notes: string; today: string }): string[] {
  // One value per line: numbers next to each other in the JSON must not read as one
  return [JSON.stringify(params.extraction, null, 1), params.notes, params.today];
}

export interface UnsupportedFact {
  /** "subject" or "paragraphs[1]" */
  field: string;
  text: string;
}

/** Numbers of the German text of the draft that none of the sources contains */
export function unsupportedFacts(
  body: Pick<ReplyBody, "subject" | "paragraphs">,
  sources: string[],
): UnsupportedFact[] {
  const known = factKeys(sources);
  const parts: [string, string][] = [
    ["subject", body.subject],
    ...body.paragraphs.map((text, i): [string, string] => [`paragraphs[${i}]`, text]),
  ];
  return parts.flatMap(([field, text]) =>
    factTokens(text)
      .filter((token) => token.keys.length > 0 && !token.keys.some((key) => known.has(key)))
      .map((token) => ({ field, text: token.text })),
  );
}

/** The unsupported numbers as issues for the reply writer */
export function factIssues(facts: UnsupportedFact[]): AgentIssue[] {
  return facts.map((fact) => ({
    field: fact.field,
    problem: `"${fact.text}" is neither in the letter nor in the user's notes. Leave it out or write a placeholder.`,
    evidence: "not in the letter",
  }));
}

/**
 * The last safeguard before a draft is saved: numbers that no source contains become a
 * placeholder, which the page asks the user to fill in. The translation is not changed; it
 * follows the German text and the user signs the German one.
 */
export function withoutUnsupportedFacts<B extends Pick<ReplyBody, "subject" | "paragraphs">>(
  body: B,
  sources: string[],
): { body: B; replaced: string[] } {
  const known = factKeys(sources);
  const replaced: string[] = [];
  const clean = (text: string) => {
    let result = text;
    const tokens = factTokens(text).filter((t) => t.keys.length > 0 && !t.keys.some((key) => known.has(key)));
    for (const token of tokens.reverse()) {
      replaced.unshift(token.text);
      result = result.slice(0, token.start) + UNSUPPORTED_PLACEHOLDER + result.slice(token.end);
    }
    return result;
  };
  const subject = clean(body.subject);
  const paragraphs = body.paragraphs.map(clean);
  return { body: { ...body, subject, paragraphs }, replaced };
}
