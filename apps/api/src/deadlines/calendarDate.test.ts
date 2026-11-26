import { describe, expect, it } from "vitest";
import { addDays, addMonths, isIsoDate, weekday } from "./calendarDate";

describe("calendarDate", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("28.02.2026")).toBe(false);
  });

  it("adds days across months, years and the DST change", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds months and clamps to the end of shorter months (§ 188 (3) BGB)", () => {
    expect(addMonths("2026-03-15", 1)).toBe("2026-04-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-08-31", 1)).toBe("2026-09-30");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2028-02-29", 12)).toBe("2029-02-28");
  });

  it("knows weekdays", () => {
    expect(weekday("2026-11-22")).toBe(0);
    expect(weekday("2025-04-07")).toBe(1);
  });
});
