import { describe, expect, it, vi } from "vitest";
import { partsOf as claudeParts, toClaudeBlock, toClaudeMessages } from "./ClaudeProvider";
import { LLMError } from "./errors";
import type { ChatTurn, JsonGenerationResult, LLMProvider } from "./LLMProvider";
import { partsOf as openAIParts, toOpenAIMessages, toOpenAIPart } from "./OpenAIProvider";
import { ProviderFallback } from "./ProviderFallback";

/** A chat with one tool round, written by a model without tool call ids (e.g. Gemini) */
const chat: ChatTurn[] = [
  { role: "user", parts: [{ type: "text", text: "When is it due?" }] },
  {
    role: "model",
    model: "gemini-flash-latest",
    parts: [
      { type: "text", text: "Let me check." },
      { type: "toolCall", name: "check_date", args: { date: "2026-12-24" } },
    ],
  },
  { role: "user", parts: [{ type: "toolResult", name: "check_date", result: { workingDay: false } }] },
];

describe("ClaudeProvider", () => {
  it("sends PDFs as documents, images as images and plain text as a text document", () => {
    const pdf = toClaudeBlock({ type: "file", mimeType: "application/pdf", data: Buffer.from("%PDF") });
    const png = toClaudeBlock({ type: "file", mimeType: "image/png", data: Buffer.from("png") });
    const txt = toClaudeBlock({ type: "file", mimeType: "text/plain", data: Buffer.from("Sehr geehrte") });
    expect(pdf).toMatchObject({ type: "document", source: { type: "base64", media_type: "application/pdf" } });
    expect(png).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png" } });
    expect(txt).toEqual({ type: "document", source: { type: "text", media_type: "text/plain", data: "Sehr geehrte" } });
  });

  it("gives tool calls without ids an id and matches their results to them", () => {
    const messages = toClaudeMessages(chat, "claude-haiku-5-5");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    const call = (messages[1].content as { type: string; id?: string }[]).find((b) => b.type === "tool_use");
    expect(call?.id).toBeTruthy();
    expect(messages[2].content).toEqual([{ type: "tool_result", tool_use_id: call?.id, content: '{"workingDay":false}' }]);
  });

  it("sends its own turns back exactly as they came, thinking blocks included", () => {
    const raw = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "toolu_1", name: "check_date", input: {} },
    ];
    const turns: ChatTurn[] = [
      chat[0],
      { role: "model", model: "claude-haiku-5-5", raw, parts: [{ type: "toolCall", id: "toolu_1", name: "check_date", args: {} }] },
      { role: "user", parts: [{ type: "toolResult", id: "toolu_1", name: "check_date", result: {} }] },
    ];
    expect(toClaudeMessages(turns, "claude-haiku-5-5")[1].content).toBe(raw);
    // Another model gets the parts, without the thinking blocks
    expect(toClaudeMessages(turns, "claude-sonnet-5-5")[1].content).toEqual([
      { type: "tool_use", id: "toolu_1", name: "check_date", input: {} },
    ]);
  });

  it("joins text blocks and keeps tool calls in order", () => {
    const parts = claudeParts([
      { type: "text", text: "Moment, ", citations: null },
      { type: "text", text: "ich prüfe.", citations: null },
      { type: "tool_use", id: "toolu_2", name: "list_reminders", input: {}, caller: { type: "direct" } },
    ] as Parameters<typeof claudeParts>[0]);
    expect(parts).toEqual([
      { type: "text", text: "Moment, ich prüfe." },
      { type: "toolCall", id: "toolu_2", name: "list_reminders", args: {} },
    ]);
  });
});

describe("OpenAIProvider", () => {
  it("sends PDFs as files, images as data URLs and plain text as text", () => {
    expect(toOpenAIPart({ type: "file", mimeType: "application/pdf", data: Buffer.from("%PDF") })).toMatchObject({
      type: "file",
      file: { filename: "letter.pdf", file_data: "data:application/pdf;base64,JVBERg==" },
    });
    expect(toOpenAIPart({ type: "file", mimeType: "image/jpeg", data: Buffer.from("jpg") })).toMatchObject({
      type: "image_url",
    });
    expect(toOpenAIPart({ type: "file", mimeType: "text/plain", data: Buffer.from("Hallo") })).toEqual({
      type: "text",
      text: "Hallo",
    });
  });

  it("turns tool results into tool messages that answer the calls before them", () => {
    const messages = toOpenAIMessages(chat);
    expect(messages[1]).toMatchObject({ role: "assistant", content: "Let me check." });
    const id = (messages[1] as { tool_calls: { id: string }[] }).tool_calls[0].id;
    expect(messages[2]).toEqual({ role: "tool", tool_call_id: id, content: '{"workingDay":false}' });
    expect(messages).toHaveLength(3);
  });

  it("reads text and tool calls from an answer, tolerating invalid arguments", () => {
    const parts = openAIParts({
      role: "assistant",
      content: "Moment.",
      refusal: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "check_date", arguments: '{"date":"2026-12-24"}' } },
        { id: "call_2", type: "function", function: { name: "list_reminders", arguments: "{not json" } },
      ],
    });
    expect(parts).toEqual([
      { type: "text", text: "Moment." },
      { type: "toolCall", id: "call_1", name: "check_date", args: { date: "2026-12-24" } },
      { type: "toolCall", id: "call_2", name: "list_reminders", args: {} },
    ]);
  });
});

describe("ProviderFallback", () => {
  const answer = (model: string): JsonGenerationResult => ({
    text: "{}",
    model,
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 5,
    failedAttempts: [],
  });
  const fake = (name: string, model: string, generateJson: LLMProvider["generateJson"]) =>
    ({ name, model, embeddingModel: `${name}-embed`, generateJson: vi.fn(generateJson), embed: vi.fn() }) as unknown as LLMProvider;
  const overloaded = (model: string) => new LLMError(`${model} overloaded`, true, "busy", "AI_OVERLOADED", 529, model);
  const request = { system: "", input: [], jsonSchema: {} };

  it("lets the other provider answer when the primary is overloaded, and logs the switch", async () => {
    const claude = fake("anthropic", "claude-haiku-5-5", () => Promise.reject(overloaded("claude-haiku-5-5")));
    const openai = fake("openai", "gpt-6-luna", async () => answer("gpt-6-luna"));
    const result = await new ProviderFallback(claude, openai, openai).generateJson(request);

    expect(result).toMatchObject({ model: "gpt-6-luna", provider: "openai" });
    expect(result.failedAttempts).toMatchObject([{ model: "claude-haiku-5-5", errorMessage: "claude-haiku-5-5 overloaded" }]);
  });

  it("skips the primary for a while after a switch", async () => {
    let now = 0;
    const claude = fake("anthropic", "claude-haiku-5-5", () => Promise.reject(overloaded("claude-haiku-5-5")));
    const openai = fake("openai", "gpt-6-luna", async () => answer("gpt-6-luna"));
    const llm = new ProviderFallback(claude, openai, openai, () => now);

    await llm.generateJson(request);
    now = 60_000;
    await llm.generateJson(request);
    expect(claude.generateJson).toHaveBeenCalledTimes(1);
    now = 10 * 60_000;
    await llm.generateJson(request);
    expect(claude.generateJson).toHaveBeenCalledTimes(2);
  });

  it("does not switch for errors another provider would not fix", async () => {
    const keyRejected = new LLMError("bad key", false, "key", "AI_KEY_REJECTED", 401, "claude-haiku-5-5");
    const claude = fake("anthropic", "claude-haiku-5-5", () => Promise.reject(keyRejected));
    const openai = fake("openai", "gpt-6-luna", async () => answer("gpt-6-luna"));

    await expect(new ProviderFallback(claude, openai, openai).generateJson(request)).rejects.toBe(keyRejected);
    expect(openai.generateJson).not.toHaveBeenCalled();
  });

  it("takes embeddings from the embedding provider", async () => {
    const claude = fake("anthropic", "claude-haiku-5-5", async () => answer("claude-haiku-5-5"));
    const openai = fake("openai", "gpt-6-luna", async () => answer("gpt-6-luna"));
    const llm = new ProviderFallback(claude, undefined, openai);

    expect(llm.embeddingModel).toBe("openai-embed");
    await llm.embed({ texts: ["x"], kind: "query" });
    expect(openai.embed).toHaveBeenCalled();
  });
});
