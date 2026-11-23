import { describe, expect, it } from "vitest";
import { parseRelativeDeadline, type RelativePeriod } from "./parseRelativeDeadline";

function period(rawText: string): RelativePeriod {
  const result = parseRelativeDeadline(rawText);
  if (!result.ok) throw new Error(`Expected a period for "${rawText}", got: ${result.reason}`);
  return result.period;
}

function reason(rawText: string): string {
  const result = parseRelativeDeadline(rawText);
  if (result.ok) throw new Error(`Expected no period for "${rawText}"`);
  return result.reason;
}

describe("parseRelativeDeadline", () => {
  it.each([
    ["innerhalb eines Monats nach Bekanntgabe dieses Bescheides", 1, "MONTH"],
    ["binnen eines Monats nach Zugang", 1, "MONTH"],
    ["innerhalb von zwei Wochen nach Erhalt dieses Schreibens", 2, "WEEK"],
    ["innerhalb einer Woche", 1, "WEEK"],
    ["binnen 14 Tagen", 14, "DAY"],
    ["innerhalb von 10 Kalendertagen", 10, "DAY"],
    ["innerhalb von drei Monaten", 3, "MONTH"],
    ["binnen eines Jahres nach Bekanntgabe", 1, "YEAR"],
    ["innerhalb von zwei (2) Wochen", 2, "WEEK"],
    ["Der Einspruch ist binnen Monatsfrist einzulegen", 1, "MONTH"],
    ["innerhalb von vierzehn Tagen", 14, "DAY"],
    ["Bitte zahlen Sie innerhalb von 7 Tagen.", 7, "DAY"],
  ] as const)("%s -> %i %s", (text, amount, unit) => {
    expect(period(text)).toMatchObject({ amount, unit });
  });

  it("is not confused by line breaks and extra spaces", () => {
    expect(period("innerhalb  eines\nMonats nach\nBekanntgabe")).toMatchObject({
      amount: 1,
      unit: "MONTH",
      anchor: "RECEIPT",
    });
  });

  describe("start of the period", () => {
    it.each([
      ["innerhalb eines Monats nach Bekanntgabe", "RECEIPT"],
      ["binnen zwei Wochen nach Zugang dieses Schreibens", "RECEIPT"],
      ["innerhalb von 14 Tagen nach Erhalt", "RECEIPT"],
      ["innerhalb von 10 Tagen nach Eingang dieses Schreibens", "RECEIPT"],
      ["binnen eines Monats nach Zustellung", "SERVICE"],
      ["zahlbar innerhalb von 14 Tagen nach Rechnungsdatum", "LETTER_DATE"],
      ["innerhalb von 2 Wochen ab Datum dieses Schreibens", "LETTER_DATE"],
    ] as const)("%s -> %s", (text, anchor) => {
      expect(period(text)).toMatchObject({ anchor, anchorStated: true });
    });

    it("assumes receipt when the wording names no start", () => {
      expect(period("binnen 14 Tagen")).toMatchObject({ anchor: "RECEIPT", anchorStated: false });
    });
  });

  describe("returns a reason instead of guessing", () => {
    it("for working days", () => {
      expect(reason("innerhalb von 5 Werktagen")).toMatch(/working days/);
      expect(reason("binnen 3 Arbeitstagen")).toMatch(/working days/);
    });

    it("for periods before an event", () => {
      expect(reason("spätestens eine Woche vor dem Termin")).toMatch(/before an event/);
    });

    it("for several different periods", () => {
      expect(reason("innerhalb von zwei Wochen, spätestens jedoch binnen eines Monats")).toMatch(
        /more than one/,
      );
    });

    it("for wording without a period", () => {
      expect(reason("Bitte senden Sie die Unterlagen unverzüglich zurück")).toMatch(/immediately/);
      expect(reason("bis zum Ende des Quartals")).toMatch(/No time period/);
    });

    it("for a zero period", () => {
      expect(reason("innerhalb von 0 Tagen")).toMatch(/zero/);
    });
  });

  it("does not read numbers that belong to other words", () => {
    expect(reason("Steuerjahr 2025, Tagessatz 30")).toMatch(/No time period/);
  });
});
