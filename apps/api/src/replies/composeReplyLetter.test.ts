import { describe, expect, it } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import {
  composeReplyLetter,
  findPlaceholders,
  formatGermanDate,
  objectionTerm,
  replyWarnings,
  todayInGermany,
} from "./composeReplyLetter";

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
  deadlines: [],
  requiredActions: [],
  requiredDocuments: ["Lohnsteuerbescheinigung 2025", "Nachweis Fahrtkosten"],
  objectionPossible: true,
  urgency: "HIGH",
  uncertainFields: [],
};

const body = {
  subject: "Einspruch gegen den Einkommensteuerbescheid 2025",
  paragraphs: ["hiermit lege ich Einspruch ein.", "  ", "Die Begründung reiche ich nach."],
};

describe("objectionTerm", () => {
  it("uses Einspruch for tax and child benefit offices", () => {
    expect(objectionTerm("FINANZAMT")).toBe("Einspruch");
    expect(objectionTerm("FAMILIENKASSE")).toBe("Einspruch");
  });

  it("uses Widerspruch for other authorities", () => {
    expect(objectionTerm("JOBCENTER")).toBe("Widerspruch");
    expect(objectionTerm("KRANKENKASSE")).toBe("Widerspruch");
  });
});

describe("dates", () => {
  it("formats ISO dates the German way", () => {
    expect(formatGermanDate("2026-03-02")).toBe("02.03.2026");
  });

  it("uses the German calendar day, not UTC", () => {
    // 23:30 UTC on 31 December is already 1 January in Berlin
    expect(todayInGermany(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    // Summer time: 22:30 UTC is 00:30 the next day
    expect(todayInGermany(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
    expect(todayInGermany(new Date("2026-07-14T21:30:00Z"))).toBe("2026-07-14");
  });
});

describe("composeReplyLetter", () => {
  const letter = composeReplyLetter({ type: "OBJECTION", extraction, body, date: "2026-03-20" });

  it("takes reference numbers and the letter date from the extraction", () => {
    expect(letter).toContain(
      "Einspruch gegen den Einkommensteuerbescheid 2025\nSteuernummer: 214/5678/1234\nIhr Schreiben vom 02.03.2026",
    );
  });

  it("builds the formal frame around the body and skips empty paragraphs", () => {
    expect(letter).toContain("Finanzamt Köln-Mitte\n[Anschrift laut Schreiben]");
    expect(letter).toContain("[Ort], 20.03.2026");
    expect(letter).toContain(
      "Sehr geehrte Damen und Herren,\n\nhiermit lege ich Einspruch ein.\n\nDie Begründung reiche ich nach.\n\nMit freundlichen Grüßen",
    );
    expect(letter).not.toContain("\n\n\n\n");
    expect(letter).not.toContain("Anlagen");
  });

  it("lists the requested documents as attachments of a cover letter", () => {
    const cover = composeReplyLetter({ type: "SEND_DOCUMENTS", extraction, body, date: "2026-03-20" });
    expect(cover.endsWith("Anlagen:\n- Lohnsteuerbescheinigung 2025\n- Nachweis Fahrtkosten")).toBe(true);
  });

  it("leaves out the letter date if it is missing or invalid", () => {
    const noDate = composeReplyLetter({
      type: "QUESTION",
      extraction: { ...extraction, letterDate: "2026-02-30" },
      body,
      date: "2026-03-20",
    });
    expect(noDate).not.toContain("Ihr Schreiben vom");
  });
});

describe("findPlaceholders", () => {
  it("finds each placeholder once", () => {
    expect(findPlaceholders("[Ort], [Betrag] und [Betrag]\n[Ort]")).toEqual(["[Ort]", "[Betrag]"]);
  });

  it("ignores brackets that are not placeholders", () => {
    expect(findPlaceholders("§ 37 [2] SGB X und [\n]")).toEqual([]);
  });
});

describe("replyWarnings", () => {
  const base = { extraction, contentDe: "Text ohne Platzhalter", today: "2026-03-20" };

  it("warns when the objection deadline has passed", () => {
    const warnings = replyWarnings({
      ...base,
      type: "OBJECTION",
      deadlines: [{ kind: "OBJECTION", dueDate: "2026-03-19" }],
    });
    expect(warnings[0]).toContain("(19.03.2026) may have passed");
  });

  it("states the objection deadline while it is open", () => {
    const warnings = replyWarnings({
      ...base,
      type: "OBJECTION",
      deadlines: [
        { kind: "PAYMENT", dueDate: "2026-03-10" },
        { kind: "OBJECTION", dueDate: "2026-04-07" },
      ],
    });
    expect(warnings).toEqual([expect.stringContaining("It must arrive by 07.04.2026.")]);
  });

  it("warns when the letter mentions no right to object", () => {
    const warnings = replyWarnings({
      ...base,
      type: "OBJECTION",
      extraction: { ...extraction, objectionPossible: false },
      deadlines: [],
    });
    expect(warnings).toEqual([expect.stringContaining("does not mention a right to object")]);
  });

  it("lists placeholders that still need to be filled in", () => {
    const warnings = replyWarnings({
      ...base,
      type: "QUESTION",
      contentDe: "[Ort], 20.03.2026 [Ihr Vor- und Nachname]",
      deadlines: [],
    });
    expect(warnings).toEqual(["Fill in before sending: [Ort], [Ihr Vor- und Nachname]"]);
  });
});
