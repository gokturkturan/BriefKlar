import { describe, expect, it } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import { EVAL_CASES, type EvalCase } from "./cases";
import { scoreExtraction, summarize, type CaseResult } from "./score";

const finanzamt = EVAL_CASES.find((c) => c.file.startsWith("01-")) as EvalCase;

/** A correct analysis of the Finanzamt letter */
function correctExtraction(): LetterExtraction {
  return {
    isOfficialLetter: true,
    letterLanguage: "de",
    summary: "Income tax assessment for 2025 with a back payment.",
    sender: { name: "Finanzamt Musterstadt", type: "FINANZAMT" },
    letterType: "BESCHEID",
    letterDate: "2026-09-14",
    subject: "Bescheid für 2025 über Einkommensteuer und Solidaritätszuschlag",
    references: [{ label: "Steuernummer", value: "214 / 5678 / 9012" }],
    amounts: [
      { value: 8412, currency: "EUR", purpose: "Income tax" },
      { value: 1234.56, currency: "EUR", purpose: "Back payment" },
    ],
    deadlines: [
      { rawText: "Bitte zahlen Sie den Betrag von 1.234,56 € bis zum 19.10.2026", explicitDate: "2026-10-19", kind: "PAYMENT" },
      {
        rawText: "Die Frist für die Einlegung des Einspruchs beträgt einen Monat. Sie beginnt mit Ablauf des Tages, an dem Ihnen dieser Bescheid bekannt gegeben worden ist.",
        explicitDate: null,
        kind: "OBJECTION",
      },
    ],
    requiredActions: ["Pay 1,234.56 EUR"],
    requiredDocuments: [],
    objectionPossible: true,
    urgency: "MEDIUM",
    uncertainFields: [],
  };
}

const failed = (checks: ReturnType<typeof scoreExtraction>) => checks.filter((c) => !c.ok).map((c) => c.field);

describe("scoreExtraction", () => {
  it("passes every check for a correct analysis", () => {
    const checks = scoreExtraction(finanzamt, correctExtraction());
    expect(failed(checks)).toEqual([]);
    // 5 single fields, 1 amount, 1 reference, 2 × (date + kind), no wrong date
    expect(checks).toHaveLength(12);
  });

  it("fails the fields that are wrong", () => {
    const extraction = { ...correctExtraction(), letterType: "INFO" as const, objectionPossible: false };
    expect(failed(scoreExtraction(finanzamt, extraction))).toEqual(["letterType", "objectionPossible"]);
  });

  it("follows a wrong letter date into the computed deadline", () => {
    const extraction = { ...correctExtraction(), letterDate: "2026-09-16" };
    // Deemed delivery 20.09. (Sunday) -> 21.09., one month later 21.10.
    expect(failed(scoreExtraction(finanzamt, extraction))).toEqual([
      "letterDate",
      "deadlines.dueDate",
      "deadlines.noWrongDate",
    ]);
  });

  it("finds a missing amount and reference", () => {
    const extraction = { ...correctExtraction(), amounts: [], references: [{ label: "St.-Nr.", value: "214/5678/9013" }] };
    expect(failed(scoreExtraction(finanzamt, extraction))).toEqual(["amounts", "references"]);
  });

  it("checks due dates computed by the deadline engine, not the model's dates", () => {
    const extraction = correctExtraction();
    // Wording with two weeks instead of a month: the engine computes 02.10.2026
    extraction.deadlines[1] = {
      rawText: "Der Einspruch ist innerhalb von zwei Wochen nach Bekanntgabe einzulegen.",
      explicitDate: null,
      kind: "OBJECTION",
    };
    const checks = scoreExtraction(finanzamt, extraction);
    expect(failed(checks)).toEqual(["deadlines.dueDate", "deadlines.noWrongDate"]);
    expect(checks.find((c) => c.field === "deadlines.noWrongDate")?.actual).toEqual([
      '2026-10-02 OBJECTION: "Der Einspruch ist innerhalb von zwei Wochen nach Bekanntgabe einzulegen."',
    ]);
  });

  it("lists every extracted deadline with kind and wording when a due date is missing", () => {
    const extraction = correctExtraction();
    extraction.deadlines[1] = { rawText: "Einspruch ist möglich.", explicitDate: null, kind: "OBJECTION" };
    const missing = scoreExtraction(finanzamt, extraction).find((c) => c.field === "deadlines.dueDate" && !c.ok);
    expect(missing?.actual).toEqual([
      '2026-10-19 PAYMENT: "Bitte zahlen Sie den Betrag von 1.234,56 € bis zum 19.10.2026"',
      'no date OBJECTION: "Einspruch ist möglich."',
    ]);
  });

  it("counts a deadline with the right date but the wrong kind only as a wrong kind", () => {
    const extraction = correctExtraction();
    extraction.deadlines[1] = { ...extraction.deadlines[1], kind: "RESPONSE" };
    expect(failed(scoreExtraction(finanzamt, extraction))).toEqual(["deadlines.kind"]);
  });

  it("only checks isOfficialLetter for a letter that is not official", () => {
    const invitation = EVAL_CASES.find((c) => !c.isOfficialLetter) as EvalCase;
    const checks = scoreExtraction(invitation, { ...correctExtraction(), isOfficialLetter: false });
    expect(checks.map((c) => [c.field, c.ok])).toEqual([["isOfficialLetter", true]]);
  });
});

describe("summarize", () => {
  const result = (outcome: CaseResult["outcome"], oks: boolean[], costUsd: number | null = 0.001): CaseResult => ({
    file: "x.txt",
    outcome,
    model: "m",
    checks: oks.map((ok, i) => ({ field: i === 0 ? "letterDate" : "amounts", ok, expected: null, actual: null })),
    latencyMs: 1000,
    inputTokens: 100,
    outputTokens: 10,
    costUsd,
  });

  it("separates schema conformance from field accuracy", () => {
    const summary = summarize([result("valid", [true, true]), result("repaired", [true, false]), result("error", [])]);
    expect(summary.outcomes).toEqual({ valid: 1, repaired: 1, invalid: 0, error: 1 });
    expect(summary.schemaConformance).toBeCloseTo(2 / 3);
    expect(summary.fieldAccuracy).toBe(0.75);
    expect(summary.perfectCases).toBe(1);
    expect(summary.byField).toEqual([
      { field: "letterDate", passed: 2, total: 2, accuracy: 1 },
      { field: "amounts", passed: 1, total: 2, accuracy: 0.5 },
    ]);
    expect(summary.medianLatencyMs).toBe(1000);
    expect(summary.costUsd).toBeCloseTo(0.003);
  });

  it("has no total cost when a model has no price", () => {
    expect(summarize([result("valid", [true], null)]).costUsd).toBeNull();
  });
});

describe("EVAL_CASES", () => {
  it("has a letter file for every case", async () => {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(new URL("./letters", import.meta.url));
    expect(EVAL_CASES.map((c) => c.file).filter((file) => !files.includes(file))).toEqual([]);
  });
});
