import { describe, expect, it } from "vitest";
import { costOf, priceOf } from "./pricing";

describe("priceOf", () => {
  it("knows the configured models", () => {
    expect(priceOf("claude-haiku-5-5")).toEqual({ inputPerMillion: 0.1, outputPerMillion: 0.5 });
    expect(priceOf("gpt-6-luna")).toEqual({ inputPerMillion: 0.1, outputPerMillion: 0.5 });
  });

  it("uses the longest matching name for versioned models", () => {
    expect(priceOf("claude-haiku-5-5-20261001")?.inputPerMillion).toBe(0.1);
    expect(priceOf("models/gpt-6-luna")?.outputPerMillion).toBe(0.5);
  });

  it("does not match a model that only shares the beginning of a name", () => {
    expect(priceOf("gpt-6-lunar")).toBeUndefined();
    expect(priceOf("some-other-model")).toBeUndefined();
  });
});

describe("costOf", () => {
  it("adds input and output tokens at their prices", () => {
    // 10,000 input tokens at $2/M + 2,000 output tokens at $10/M
    expect(costOf("claude-sonnet-5-5", 10_000, 2_000)).toBeCloseTo(0.04, 6);
  });

  it("rounds to the six decimal places the column stores", () => {
    expect(costOf("claude-haiku-5-5", 1, 1)).toBe(0.000001);
  });

  it("returns null for a model without a price", () => {
    expect(costOf("unknown-model", 100, 100)).toBeNull();
  });
});
