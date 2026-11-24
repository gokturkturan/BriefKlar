import { describe, expect, it } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import { explanationFacts } from "./explanationFacts";

const extraction: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "The tax office has set your income tax for 2025.",
  sender: { name: "Finanzamt Köln-Mitte", type: "FINANZAMT" },
  letterType: "BESCHEID",
  letterDate: "2026-03-02",
  subject: "Einkommensteuerbescheid 2025",
  references: [{ label: "Steuernummer", value: "214/5678/1234" }],
  amounts: [{ value: 312.5, currency: "EUR", purpose: "Nachzahlung" }],
  deadlines: [
    { rawText: "innerhalb eines Monats nach Bekanntgabe", explicitDate: null, kind: "OBJECTION" },
    { rawText: "eine Woche vor dem Termin", explicitDate: null, kind: "DOCUMENTS" },
  ],
  requiredActions: ["Pay 312.50 EUR"],
  requiredDocuments: [],
  objectionPossible: true,
  urgency: "HIGH",
  uncertainFields: [],
};

describe("explanationFacts", () => {
  it("passes computed due dates and marks estimates", () => {
    const facts = explanationFacts(extraction, [
      {
        dueDate: new Date("2026-04-07T00:00:00Z"),
        kind: "OBJECTION",
        sourceText: "innerhalb eines Monats nach Bekanntgabe",
        isEstimate: true,
      },
    ]);
    expect(facts).toContain(
      '- Objection (Widerspruch): due 2026-04-07 (estimated). Letter says: "innerhalb eines Monats nach Bekanntgabe"',
    );
  });

  it("says when a deadline has no date instead of leaving it to the model", () => {
    const facts = explanationFacts(extraction, []);
    expect(facts).toContain('no date could be calculated. Letter says: "eine Woche vor dem Termin"');
    expect(facts).not.toContain("due ");
  });

  it("includes the analysis without the model's own summary", () => {
    const facts = explanationFacts({ ...extraction, deadlines: [] }, []);
    expect(facts).toContain("The letter contains no deadlines.");
    expect(facts).toContain("Einkommensteuerbescheid 2025");
    expect(facts).not.toContain(extraction.summary);
  });
});
