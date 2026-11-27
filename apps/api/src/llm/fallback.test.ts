import { describe, expect, it, vi } from "vitest";
import { LLMError } from "./errors";
import { FallbackRunner, PRIMARY_COOLDOWN_MS } from "./fallback";

function apiError(status: number, model: string): LLMError {
  return new LLMError(`${model} failed with ${status}`, true, "busy", "AI_OVERLOADED", status, model);
}

/** A clock the test moves forward, so latencies and the cooldown are exact */
function fakeClock() {
  let time = 1_000;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

function runner(clock = fakeClock()) {
  const toError = (err: unknown, model: string) =>
    err instanceof LLMError ? err : new LLMError(String(err), false, "failed", "AI_FAILED", undefined, model);
  return { clock, models: new FallbackRunner("big", "small", toError, clock.now) };
}

describe("FallbackRunner", () => {
  it("returns the primary's answer without failed attempts", async () => {
    const { clock, models } = runner();
    const result = await models.run(async (model) => {
      clock.advance(300);
      return `answer from ${model}`;
    });
    expect(result).toEqual({ value: "answer from big", model: "big", latencyMs: 300, failedAttempts: [] });
  });

  it("records the primary as a failed attempt when the fallback answers", async () => {
    const { clock, models } = runner();
    const result = await models.run(async (model) => {
      if (model === "big") {
        clock.advance(20_000);
        throw apiError(503, model);
      }
      clock.advance(800);
      return "ok";
    });

    expect(result.model).toBe("small");
    expect(result.latencyMs).toBe(800);
    expect(result.failedAttempts).toEqual([{ model: "big", errorMessage: "big failed with 503", latencyMs: 20_000 }]);
  });

  it("goes straight to the fallback during the cooldown, then tries the primary again", async () => {
    const { clock, models } = runner();
    const call = vi.fn(async (model: string) => {
      if (model === "big" && call.mock.calls.length === 1) throw apiError(429, model);
      return model;
    });

    await models.run(call);
    const during = await models.run(call);
    expect(during).toMatchObject({ value: "small", failedAttempts: [] });

    clock.advance(PRIMARY_COOLDOWN_MS);
    const after = await models.run(call);
    expect(after.value).toBe("big");
    expect(call.mock.calls.map(([model]) => model)).toEqual(["big", "small", "small", "big"]);
  });

  it("does not fall back for errors that are not about load", async () => {
    const { models } = runner();
    const call = vi.fn(async (model: string): Promise<string> => {
      throw apiError(400, model);
    });
    await expect(models.run(call)).rejects.toMatchObject({ statusCode: 400, failedAttempts: [] });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not fall back once output has reached the user", async () => {
    const { models } = runner();
    const call = vi.fn(async (model: string): Promise<string> => {
      throw apiError(503, model);
    });
    await expect(models.run(call, () => false)).rejects.toMatchObject({ model: "big" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("attaches the failed primary to the error when the fallback fails too", async () => {
    const { clock, models } = runner();
    const error = await models
      .run(async (model): Promise<string> => {
        clock.advance(model === "big" ? 5_000 : 1_500);
        throw apiError(503, model);
      })
      .catch((err: unknown) => err as LLMError);

    expect(error.model).toBe("small");
    expect(error.latencyMs).toBe(1_500);
    expect(error.failedAttempts).toEqual([{ model: "big", errorMessage: "big failed with 503", latencyMs: 5_000 }]);
  });
});
