import type { LetterExtraction } from "@briefklar/shared";
import { deadlineRows } from "../deadlines";
import { toIsoDate } from "../deadlines/calendarDate";
import type { EvalCase } from "./cases";

/** How the model's answer matched the schema */
export type SchemaOutcome =
  | "valid" // valid at the first answer
  | "repaired" // valid after the validation errors were sent back
  | "invalid" // still invalid after the repair attempt
  | "error"; // no usable answer: timeout, overload, rate limit...

export interface FieldCheck {
  field: string;
  ok: boolean;
  expected: unknown;
  actual: unknown;
}

const oneOf = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

/** Reference numbers are compared without spaces and case, and may be part of a longer value */
const normalizeReference = (value: string) => value.replace(/\s+/g, "").toLowerCase();

const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;

/**
 * Compares an extraction with the expected values of a case. Every check is one FieldCheck,
 * so the report can give an accuracy per field over all cases.
 */
export function scoreExtraction(testCase: EvalCase, extraction: LetterExtraction): FieldCheck[] {
  const checks: FieldCheck[] = [];
  const check = (field: string, ok: boolean, expected: unknown, actual: unknown) =>
    checks.push({ field, ok, expected, actual });

  check("isOfficialLetter", extraction.isOfficialLetter === testCase.isOfficialLetter, testCase.isOfficialLetter, extraction.isOfficialLetter);
  if (testCase.senderType !== undefined) {
    check("sender.type", extraction.sender.type === testCase.senderType, testCase.senderType, extraction.sender.type);
  }
  if (testCase.letterType !== undefined) {
    check("letterType", oneOf(testCase.letterType).includes(extraction.letterType), testCase.letterType, extraction.letterType);
  }
  if (testCase.letterDate !== undefined) {
    check("letterDate", extraction.letterDate === testCase.letterDate, testCase.letterDate, extraction.letterDate);
  }
  if (testCase.objectionPossible !== undefined) {
    check("objectionPossible", extraction.objectionPossible === testCase.objectionPossible, testCase.objectionPossible, extraction.objectionPossible);
  }

  if (testCase.amounts !== undefined) {
    const found = extraction.amounts.map((amount) => amount.value);
    if (testCase.amounts.length === 0) {
      check("amounts", found.length === 0, [], found);
    }
    for (const value of testCase.amounts) {
      check("amounts", found.some((amount) => sameAmount(amount, value)), value, found);
    }
  }

  if (testCase.references !== undefined) {
    const found = extraction.references.map((reference) => normalizeReference(reference.value));
    for (const value of testCase.references) {
      const wanted = normalizeReference(value);
      check("references", found.some((reference) => reference.includes(wanted)), value, extraction.references.map((r) => r.value));
    }
  }

  if (testCase.deadlines !== undefined) checks.push(...scoreDeadlines(testCase, extraction));

  return checks;
}

/**
 * Runs the deadline engine on the extracted wording, as the worker does, and compares the
 * due dates. Each expected deadline needs a computed deadline with the same date (one each);
 * its kind is a separate check. A due date that is neither expected nor optional is an error
 * of its own: a wrong date is worse than a missing one.
 */
function scoreDeadlines(testCase: EvalCase, extraction: LetterExtraction): FieldCheck[] {
  const checks: FieldCheck[] = [];
  const computed = deadlineRows("eval", extraction).map((row) => ({
    kind: row.kind,
    dueDate: toIsoDate(row.dueDate),
    sourceText: row.sourceText,
  }));
  const unused = [...computed];

  for (const expected of testCase.deadlines ?? []) {
    const kinds: string[] = oneOf(expected.kind);
    const sameDate = unused.filter((row) => row.dueDate === expected.dueDate);
    const match = sameDate.find((row) => kinds.includes(row.kind)) ?? sameDate[0];
    if (match) unused.splice(unused.indexOf(match), 1);

    checks.push({
      field: "deadlines.dueDate",
      ok: match !== undefined,
      expected: expected.dueDate,
      actual: computed.map((row) => row.dueDate),
    });
    if (match) {
      checks.push({ field: "deadlines.kind", ok: kinds.includes(match.kind), expected: expected.kind, actual: match.kind });
    }
  }

  const allowed = new Set([...(testCase.deadlines ?? []).map((d) => d.dueDate), ...(testCase.optionalDueDates ?? [])]);
  const wrong = computed.filter((row) => !allowed.has(row.dueDate));
  checks.push({
    field: "deadlines.noWrongDate",
    ok: wrong.length === 0,
    expected: [...allowed],
    actual: wrong.map((row) => `${row.dueDate} (${row.sourceText})`),
  });
  return checks;
}

export interface CaseResult {
  file: string;
  outcome: SchemaOutcome;
  /** The model that answered */
  model: string | null;
  checks: FieldCheck[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  error?: string;
}

export interface FieldAccuracy {
  field: string;
  passed: number;
  total: number;
  accuracy: number;
}

export interface EvalSummary {
  cases: number;
  outcomes: Record<SchemaOutcome, number>;
  /** Share of letters with a valid answer (at once or after the repair) */
  schemaConformance: number;
  /** Passed checks of all checks, over the letters with a valid answer */
  fieldAccuracy: number;
  byField: FieldAccuracy[];
  /** Letters whose every check passed */
  perfectCases: number;
  medianLatencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(results: CaseResult[]): EvalSummary {
  const outcomes: Record<SchemaOutcome, number> = { valid: 0, repaired: 0, invalid: 0, error: 0 };
  for (const result of results) outcomes[result.outcome]++;

  const answered = results.filter((result) => result.outcome === "valid" || result.outcome === "repaired");
  const checks = answered.flatMap((result) => result.checks);
  const fields = [...new Set(checks.map((c) => c.field))];
  const byField = fields.map((field) => {
    const own = checks.filter((c) => c.field === field);
    const passed = own.filter((c) => c.ok).length;
    return { field, passed, total: own.length, accuracy: passed / own.length };
  });
  const costs = results.map((result) => result.costUsd);

  return {
    cases: results.length,
    outcomes,
    schemaConformance: results.length ? answered.length / results.length : 0,
    fieldAccuracy: checks.length ? checks.filter((c) => c.ok).length / checks.length : 0,
    byField,
    perfectCases: answered.filter((result) => result.checks.every((c) => c.ok)).length,
    medianLatencyMs: median(results.filter((r) => r.outcome !== "error").map((r) => r.latencyMs)),
    inputTokens: results.reduce((sum, r) => sum + r.inputTokens, 0),
    outputTokens: results.reduce((sum, r) => sum + r.outputTokens, 0),
    costUsd: costs.some((cost) => cost === null) ? null : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0),
  };
}
