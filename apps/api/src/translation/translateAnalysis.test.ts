import { describe, expect, it } from "vitest";
import { translatableTexts, translationSchemaFor, type LetterExtraction } from "@briefklar/shared";

const extraction: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "The tax office wants your income tax return for 2025.",
  sender: { name: "Finanzamt Köln-Mitte", type: "FINANZAMT" },
  letterType: "AUFFORDERUNG",
  letterDate: "2026-11-02",
  subject: "Erinnerung an die Abgabe der Einkommensteuererklärung 2025",
  references: [{ label: "Steuernummer", value: "214/5000/1234" }],
  amounts: [{ value: 25, currency: "EUR", purpose: "Late filing fee" }],
  deadlines: [],
  requiredActions: ["Send the tax return", "Keep the receipts"],
  requiredDocuments: [],
  objectionPossible: false,
  urgency: "MEDIUM",
  uncertainFields: [],
};

const source = translatableTexts(extraction);

const translation = {
  summary: "Vergi dairesi 2025 yılı gelir vergisi beyannamenizi istiyor.",
  requiredActions: ["Vergi beyannamesini gönderin", "Fişleri saklayın"],
  requiredDocuments: [],
  amountPurposes: ["Geç beyan cezası (Verspätungszuschlag)"],
  referenceLabels: ["Vergi numarası (Steuernummer)"],
};

describe("translatableTexts", () => {
  it("takes the texts a reader sees, one entry per amount and reference", () => {
    expect(source).toEqual({
      summary: extraction.summary,
      requiredActions: ["Send the tax return", "Keep the receipts"],
      requiredDocuments: [],
      amountPurposes: ["Late filing fee"],
      referenceLabels: ["Steuernummer"],
    });
  });
});

describe("translationSchemaFor", () => {
  const schema = translationSchemaFor(source);

  it("accepts a translation with the same number of items", () => {
    expect(schema.safeParse(translation).success).toBe(true);
  });

  it("rejects merged or dropped items, so texts stay next to the right checkbox", () => {
    const merged = { ...translation, requiredActions: ["Beyannameyi gönderin ve fişleri saklayın"] };
    expect(schema.safeParse(merged).success).toBe(false);
    expect(schema.safeParse({ ...translation, referenceLabels: [] }).success).toBe(false);
  });

  it("rejects an empty summary", () => {
    expect(schema.safeParse({ ...translation, summary: "" }).success).toBe(false);
  });
});
