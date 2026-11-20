import { describe, expect, it } from "vitest";
import { findGermanDates, resolveExplicitDate } from "./germanDates";

describe("findGermanDates", () => {
  it("finds dates written as DD.MM.YYYY", () => {
    expect(findGermanDates("spätestens bis zum 31.08.2026 zurückzugeben")).toEqual(["2026-08-31"]);
  });

  it("accepts single-digit day and month and a space after the dots", () => {
    expect(findGermanDates("bis 1.3.2026 oder 5. 4. 2026")).toEqual(["2026-03-01", "2026-04-05"]);
  });

  it("skips impossible dates", () => {
    expect(findGermanDates("am 31.02.2026 oder am 29.02.2025")).toEqual([]);
    expect(findGermanDates("am 29.02.2024")).toEqual(["2024-02-29"]);
  });

  it("ignores text without dates", () => {
    expect(findGermanDates("innerhalb eines Monats nach Bekanntgabe")).toEqual([]);
  });
});

describe("resolveExplicitDate", () => {
  it("uses the single date in the wording and ignores the model's value", () => {
    expect(resolveExplicitDate("bis zum 15.12.2026 zahlen", "2026-12-16")).toBe("2026-12-15");
  });

  it("accepts the model's choice only if it is one of several dates", () => {
    const text = "Termin am 03.12.2026, Unterlagen bis 01.12.2026";
    expect(resolveExplicitDate(text, "2026-12-01")).toBe("2026-12-01");
    expect(resolveExplicitDate(text, "2026-12-02")).toBeNull();
    expect(resolveExplicitDate(text, null)).toBeNull();
  });

  it("returns null for relative wording", () => {
    expect(resolveExplicitDate("binnen zwei Wochen nach Zugang", "2026-12-01")).toBeNull();
  });
});
