import { describe, expect, it } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import {
  UNSUPPORTED_PLACEHOLDER,
  factTokens,
  replySources,
  unsupportedFacts,
  withoutUnsupportedFacts,
} from "./replyFacts";
import { missingReplyNotes } from "./replyNotes";

const extraction: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "The tax office wants 1,240 EUR back.",
  sender: { name: "Finanzamt Köln-Mitte", type: "FINANZAMT" },
  letterType: "BESCHEID",
  letterDate: "2026-03-02",
  subject: "Einkommensteuerbescheid 2025",
  references: [{ label: "Steuernummer", value: "214/5678/9012" }],
  amounts: [{ value: 1240, currency: "EUR", purpose: "Nachzahlung" }],
  deadlines: [{ rawText: "innerhalb eines Monats nach Bekanntgabe", explicitDate: null, kind: "OBJECTION" }],
  requiredActions: [],
  requiredDocuments: [],
  objectionPossible: true,
  urgency: "HIGH",
  uncertainFields: [],
};

const sources = replySources({ extraction, notes: "Ich kann 50 Euro im Monat zahlen.", today: "2026-11-19" });

describe("unsupportedFacts", () => {
  it("accepts the letter's numbers in any way they are written", () => {
    const body = {
      subject: "Einspruch gegen den Einkommensteuerbescheid 2025 vom 02.03.2026",
      paragraphs: [
        "Ihren Bescheid vom 2. März 2026 über 1.240,00 € (Steuernummer 214/5678/9012) habe ich erhalten.",
        "Ich biete Raten von 50 € monatlich an. Heute ist der 19.11.2026, der Bescheid kam am 02.03. an.",
      ],
    };
    expect(unsupportedFacts(body, sources)).toEqual([]);
  });

  it("finds amounts, dates and reference numbers that neither the letter nor the notes contain", () => {
    const body = {
      subject: "Ratenzahlung",
      paragraphs: [
        "Ich zahle 1.300,00 € bis zum 15.04.2026.",
        "Mein Aktenzeichen ist 98765.",
        "Siehe [Datum] und 2 Wochen.",
      ],
    };
    expect(unsupportedFacts(body, sources)).toEqual([
      { field: "paragraphs[0]", text: "1.300,00" },
      { field: "paragraphs[0]", text: "15.04.2026" },
      { field: "paragraphs[1]", text: "98765" },
    ]);
  });

  it("skips placeholders and single digits", () => {
    expect(factTokens("[Betrag von 99 €] in 3 Raten")).toEqual([]);
  });
});

describe("withoutUnsupportedFacts", () => {
  it("replaces only the unsupported numbers with a placeholder", () => {
    const { body, replaced } = withoutUnsupportedFacts(
      {
        subject: "Bescheid vom 02.03.2026",
        paragraphs: ["Ich zahle 75 € ab dem 1. Mai 2026 und 50 € danach."],
        translation: "x",
      },
      sources,
    );
    expect(replaced).toEqual(["75", "1. Mai 2026"]);
    expect(body.subject).toBe("Bescheid vom 02.03.2026");
    expect(body.paragraphs[0]).toBe(
      `Ich zahle ${UNSUPPORTED_PLACEHOLDER} € ab dem ${UNSUPPORTED_PLACEHOLDER} und 50 € danach.`,
    );
    expect(body.translation).toBe("x");
  });
});

describe("missingReplyNotes", () => {
  it("asks for what only the user knows", () => {
    expect(missingReplyNotes("OBJECTION", "")).toEqual(["reasons"]);
    expect(missingReplyNotes("OBJECTION", "Ich war krank")).toEqual([]);
    expect(missingReplyNotes("INSTALLMENT_PLAN", "Ich habe meine Arbeit verloren")).toEqual(["monthlyAmount"]);
    expect(missingReplyNotes("INSTALLMENT_PLAN", "50 Euro im Monat")).toEqual([]);
    expect(missingReplyNotes("EXTENSION_REQUEST", " ")).toEqual(["newDate"]);
    expect(missingReplyNotes("QUESTION", "")).toEqual(["question"]);
    expect(missingReplyNotes("SEND_DOCUMENTS", "")).toEqual([]);
  });
});
