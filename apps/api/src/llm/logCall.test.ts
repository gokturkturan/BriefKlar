import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { LLMError } from "./errors";
import { generateStructured } from "./generateStructured";
import type { JsonGenerationResult, LLMProvider } from "./LLMProvider";
import { FALLBACK_SWITCH_NOTE, loggedCall } from "./logCall";

vi.mock("../lib/prisma", () => ({ prisma: { llmCall: { create: vi.fn() } } }));

const create = vi.mocked(prisma.llmCall.create);
const logged = () => create.mock.calls.map(([args]) => args.data);

const provider = { name: "fake", model: "big" } as LLMProvider;
const context = { provider, purpose: "test", promptVersion: "v1" };

beforeEach(() => create.mockReset());

describe("loggedCall", () => {
  it("logs a switch to the fallback model before the answer", async () => {
    await loggedCall(context, async () => ({
      model: "small",
      latencyMs: 20,
      inputTokens: 10,
      outputTokens: 5,
      failedAttempts: [{ model: "big", errorMessage: "503", latencyMs: 7 }],
    }));
    expect(logged()).toMatchObject([
      { model: "big", success: false, latencyMs: 7, errorMessage: `503 ${FALLBACK_SWITCH_NOTE}` },
      { model: "small", success: true, inputTokens: 10, outputTokens: 5, latencyMs: 20 },
    ]);
  });

  it("logs a failure and throws it on", async () => {
    const error = new LLMError("overloaded", true, "Try again", "AI_OVERLOADED", 503, "big");
    error.latencyMs = 30;
    await expect(loggedCall(context, () => Promise.reject(error))).rejects.toBe(error);
    expect(logged()).toMatchObject([{ model: "big", success: false, latencyMs: 30, errorMessage: "overloaded" }]);
  });

  it("marks an answer as failed when errorOf says so", async () => {
    await loggedCall(context, async () => ({ model: "big", latencyMs: 1 }), { errorOf: () => "bad answer" });
    expect(logged()).toMatchObject([{ success: false, errorMessage: "bad answer", inputTokens: 0 }]);
  });
});

describe("generateStructured", () => {
  const answer = (text: string): JsonGenerationResult => ({
    text,
    model: "big",
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 1,
    failedAttempts: [],
  });

  it("asks the model to repair an invalid answer", async () => {
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce(answer('{"count":"three"}'))
      .mockResolvedValueOnce(answer('{"count":3}'));
    const result = await generateStructured({
      provider: { ...provider, generateJson } as LLMProvider,
      schema: z.object({ count: z.number() }),
      system: "",
      input: [{ type: "text", text: "Count" }],
      purpose: "test",
      promptVersion: "v1",
    });

    expect(result).toMatchObject({ data: { count: 3 }, attempts: 2, inputTokens: 2 });
    expect(generateJson.mock.calls[1]![0].input.at(-1).text).toContain("did not match the required schema");
    expect(logged().map((row) => row.success)).toEqual([false, true]);
  });
});
