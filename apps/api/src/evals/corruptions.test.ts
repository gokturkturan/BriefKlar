import { describe, expect, it } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import { corruptionsFor, pickCorruptions } from "./corruptions";

const ANALYSIS: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "s",
  sender: { name: "Finanzamt", type: "FINANZAMT" },
  letterType: "BESCHEID",
  letterDate: "2026-09-14",
  subject: "s",
  references: [{ label: "Steuernummer", value: "214/5678/9012" }],
  amounts: [{ value: 1234.56, currency: "EUR", purpose: "tax" }],
  deadlines: [
    { rawText: "bis zum 19.10.2026", explicitDate: "2026-10-19", kind: "PAYMENT" },
    { rawText: "einen Monat", explicitDate: null, kind: "OBJECTION" },
  ],
  requiredActions: [],
  requiredDocuments: [],
  objectionPossible: true,
  urgency: "HIGH",
  uncertainFields: [],
};

describe("corruptions", () => {
  it("changes exactly the named field and leaves the analysis untouched", () => {
    const before = structuredClone(ANALYSIS);
    for (const corruption of corruptionsFor(ANALYSIS)) {
      const broken = corruption.apply(ANALYSIS);
      expect(broken[corruption.field]).not.toEqual(ANALYSIS[corruption.field]);
      const others = Object.keys(ANALYSIS).filter((key) => key !== corruption.field) as (keyof LetterExtraction)[];
      for (const key of others) expect(broken[key]).toEqual(ANALYSIS[key]);
    }
    expect(ANALYSIS).toEqual(before);
  });

  it("only offers errors that fit the analysis", () => {
    const bare = { ...ANALYSIS, amounts: [], deadlines: [], references: [], letterDate: null };
    expect(corruptionsFor(bare).map((c) => c.name)).toEqual(["objection flipped", "wrong sender type"]);
  });

  it("rotates the choice by the offset", () => {
    const names = (offset: number) => pickCorruptions(ANALYSIS, 2, offset).map((c) => c.name);
    expect(names(0)).toEqual(["amount ×10", "deadline left out"]);
    expect(names(1)).toEqual(["deadline left out", "date invented for relative wording"]);
  });
});
