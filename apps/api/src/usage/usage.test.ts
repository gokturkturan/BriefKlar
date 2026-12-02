import { describe, expect, it } from "vitest";
import { fillDays, periodStart } from "./usage";

describe("periodStart", () => {
  it("counts today as the last day of the period", () => {
    expect(periodStart("2026-12-12", 7)).toBe("2026-12-06");
    expect(periodStart("2026-03-01", 30)).toBe("2026-01-31");
  });
});

describe("fillDays", () => {
  it("adds the days without calls, oldest first", () => {
    const days = fillDays("2026-12-10", "2026-12-12", [
      { date: "2026-12-11", calls: 4, failedCalls: 1, costUsd: 0.02 },
    ]);
    expect(days).toEqual([
      { date: "2026-12-10", calls: 0, failedCalls: 0, costUsd: 0 },
      { date: "2026-12-11", calls: 4, failedCalls: 1, costUsd: 0.02 },
      { date: "2026-12-12", calls: 0, failedCalls: 0, costUsd: 0 },
    ]);
  });
});
