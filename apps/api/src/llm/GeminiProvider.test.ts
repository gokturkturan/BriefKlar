import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "./GeminiProvider";
import { LLMError } from "./errors";

/** What the fake Gemini API does for one request to `model` */
type Script = (model: string, signal: AbortSignal) => AsyncGenerator<Record<string, unknown>>;

const api = vi.hoisted(() => ({
  stream: undefined as unknown as Script,
  generate: vi.fn(),
}));

vi.mock("@google/genai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@google/genai")>();
  class GoogleGenAI {
    models = {
      generateContentStream: async ({ model, config }: { model: string; config: { abortSignal: AbortSignal } }) =>
        api.stream(model, config.abortSignal),
      generateContent: api.generate,
    };
  }
  return { ...original, GoogleGenAI };
});

const textChunk = (text: string, tokens?: { input: number; output: number; thoughts?: number }) => ({
  text,
  candidates: [{ content: { parts: [{ text }] } }],
  usageMetadata: tokens && {
    promptTokenCount: tokens.input,
    candidatesTokenCount: tokens.output,
    thoughtsTokenCount: tokens.thoughts,
  },
});

const overloaded = () => new ApiError({ message: "overloaded", status: 503 });

/** Waits until the request is aborted, like a model that never answers */
const silence = (signal: AbortSignal) =>
  new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));

const provider = () => new GeminiProvider("key", "big", "small");
const textRequest = { system: "Explain", input: [{ type: "text" as const, text: "Letter" }] };

describe("GeminiProvider", () => {
  beforeEach(() => api.generate.mockReset());
  afterEach(() => vi.useRealTimers());

  it("streams text and reports the usage of the last chunk", async () => {
    api.stream = async function* () {
      yield textChunk("Hello ");
      yield textChunk("world", { input: 100, output: 20, thoughts: 30 });
    };
    const deltas: string[] = [];
    const result = await provider().streamText(textRequest, (delta) => deltas.push(delta));

    expect(deltas).toEqual(["Hello ", "world"]);
    expect(result).toMatchObject({ text: "Hello world", model: "big", inputTokens: 100, outputTokens: 50 });
  });

  it("falls back to the smaller model when the primary is overloaded", async () => {
    api.stream = async function* (model) {
      if (model === "big") throw overloaded();
      yield textChunk("From the fallback", { input: 1, output: 1 });
    };
    const result = await provider().streamText(textRequest, () => {});

    expect(result.model).toBe("small");
    expect(result.failedAttempts).toMatchObject([{ model: "big" }]);
  });

  it("does not switch models after text reached the user", async () => {
    api.stream = async function* (model) {
      yield textChunk(`Half an answer from ${model}`);
      throw overloaded();
    };
    const deltas: string[] = [];
    await expect(provider().streamText(textRequest, (delta) => deltas.push(delta))).rejects.toBeInstanceOf(LLMError);
    expect(deltas).toEqual(["Half an answer from big"]);
  });

  it("treats a silent model as overloaded and falls back", async () => {
    vi.useFakeTimers();
    api.stream = async function* (model, signal) {
      if (model === "big") await silence(signal);
      yield textChunk("Fast answer", { input: 1, output: 1 });
    };
    const result = provider().streamText(textRequest, () => {});
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(result).resolves.toMatchObject({ model: "small", failedAttempts: [{ model: "big" }] });
  });

  it("collects text and tool calls of a chat round", async () => {
    api.stream = async function* () {
      yield textChunk("Let me check. ");
      yield {
        candidates: [{ content: { parts: [{ functionCall: { id: "c1", name: "check_date", args: { date: "2026-12-24" } } }] } }],
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 10, thoughtsTokenCount: 5 },
      };
    };
    const result = await provider().chatRound(
      { system: "", turns: [{ role: "user", parts: [{ type: "text", text: "Is it a holiday?" }] }], tools: [] },
      () => {},
    );

    expect(result.parts).toMatchObject([
      { type: "text", text: "Let me check. " },
      { type: "toolCall", id: "c1", name: "check_date", args: { date: "2026-12-24" } },
    ]);
    expect(result).toMatchObject({ inputTokens: 50, outputTokens: 15 });
  });

  it("returns the JSON text and usage of a structured answer", async () => {
    api.generate.mockResolvedValue({
      text: '{"ok":true}',
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3, thoughtsTokenCount: 40 },
    });
    const result = await provider().generateJson({ ...textRequest, jsonSchema: {} });

    // Thinking tokens are billed as output
    expect(result).toMatchObject({ text: '{"ok":true}', model: "big", inputTokens: 7, outputTokens: 43 });
  });
});
