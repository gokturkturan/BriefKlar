import { describe, expect, it } from "vitest";
import { costOf, priceOf } from "./pricing";

describe("priceOf", () => {
  it("knows the configured aliases", () => {
    expect(priceOf("gemini-flash-latest")).toEqual({ inputPerMillion: 0.3, outputPerMillion: 2.5 });
    expect(priceOf("gemini-flash-lite-latest")).toEqual({ inputPerMillion: 0.1, outputPerMillion: 0.4 });
  });

  it("uses the longest matching name for versioned models", () => {
    expect(priceOf("gemini-2.5-flash-lite-preview-09-2025")?.inputPerMillion).toBe(0.1);
    expect(priceOf("gemini-2.5-flash-preview-09-2025")?.inputPerMillion).toBe(0.3);
    expect(priceOf("models/gemini-2.5-flash")?.outputPerMillion).toBe(2.5);
  });

  it("does not match a model that only shares the beginning of a name", () => {
    expect(priceOf("gemini-2.5-flashy")).toBeUndefined();
    expect(priceOf("some-other-model")).toBeUndefined();
  });
});

describe("costOf", () => {
  it("adds input and output tokens at their prices", () => {
    // 10,000 input tokens at $0.30/M + 2,000 output tokens at $2.50/M
    expect(costOf("gemini-2.5-flash", 10_000, 2_000)).toBeCloseTo(0.008, 6);
  });

  it("rounds to the six decimal places the column stores", () => {
    expect(costOf("gemini-2.5-flash-lite", 1, 1)).toBe(0.000001);
  });

  it("returns null for a model without a price", () => {
    expect(costOf("unknown-model", 100, 100)).toBeNull();
  });
});
