import { describe, expect, it } from "vitest";
import { expiredDocumentsWhere } from "./retention";

describe("expiredDocumentsWhere", () => {
  const now = new Date("2026-12-17T18:00:00Z");

  it("has one condition per retention period, counted back from now", () => {
    const conditions = expiredDocumentsWhere(now);
    expect(conditions.map((c) => c.days)).toEqual([30, 90, 180, 365]);
    expect(conditions[0].where).toEqual({
      user: { retentionDays: 30 },
      createdAt: { lt: new Date("2026-11-17T18:00:00Z") },
      status: { not: "PROCESSING" },
    });
    expect(conditions[3].where.createdAt).toEqual({ lt: new Date("2025-12-17T18:00:00Z") });
  });
});
