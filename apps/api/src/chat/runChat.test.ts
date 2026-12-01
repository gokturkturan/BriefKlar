import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ChatRoundRequest, ChatRoundResult, LLMProvider } from "../llm/LLMProvider";
import { MAX_TOOL_ROUNDS, runChat } from "./runChat";
import type { ChatTool, ToolContext } from "./tools";

// Model calls are logged to the database; tests must not write there
vi.mock("../llm/logCall", () => ({
  logCall: vi.fn(),
  logFailedAttempts: vi.fn(),
  logFailure: vi.fn(),
}));

type Round = ChatRoundResult["parts"];

/** A provider that answers each round from a script and records what it was sent */
function scriptedProvider(rounds: Round[]) {
  const requests: ChatRoundRequest[] = [];
  const provider = {
    name: "fake",
    model: "fake-model",
    embeddingModel: "fake-embed",
    chatRound: vi.fn(async (request: ChatRoundRequest, onDelta: (text: string) => void) => {
      requests.push(structuredClone({ ...request, signal: undefined }));
      const parts = rounds.shift() ?? [{ type: "text", text: "(no more rounds)" }];
      for (const part of parts) if (part.type === "text") onDelta(part.text);
      return { parts, model: "fake-model", inputTokens: 1, outputTokens: 1, latencyMs: 1, failedAttempts: [] };
    }),
  } as unknown as LLMProvider;
  return { provider, requests };
}

const checkDate: ChatTool<{ date: string }> = {
  name: "check_date",
  description: "Checks a date",
  schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  run: async ({ date }) => ({ ok: true, result: { date, isWorkingDay: false } }),
};

const search: ChatTool<{ query: string }> = {
  name: "search_knowledge_base",
  description: "Searches",
  schema: z.object({ query: z.string() }),
  run: async () => ({
    ok: true,
    result: { results: [] },
    sources: [{ title: "Widerspruch", url: "https://www.gesetze-im-internet.de/vwgo/__70.html" }],
  }),
};

const tools = [checkDate, search] as ChatTool<unknown>[];
const context = { documentId: "doc-1" } as ToolContext;

describe("runChat", () => {
  let events: unknown[];
  beforeEach(() => {
    events = [];
  });

  const run = (provider: LLMProvider) =>
    runChat({
      provider,
      system: "system",
      promptVersion: "test",
      history: [{ role: "model", parts: [{ type: "text", text: "Earlier answer" }] }],
      message: "Is 24 December a working day?",
      context,
      tools,
      onEvent: (event) => events.push(event),
    });

  it("runs the requested tool, sends the result back and returns the answer", async () => {
    const { provider, requests } = scriptedProvider([
      [{ type: "toolCall", id: "c1", name: "check_date", args: { date: "2026-12-24" } }],
      [{ type: "text", text: "No, it is not." }],
    ]);

    const answer = await run(provider);

    expect(answer).toEqual({
      text: "No, it is not.",
      toolCalls: [{ name: "check_date", ok: true }],
      sources: [],
      model: "fake-model",
    });
    expect(requests[0]?.tools.map((t) => t.name)).toEqual(["check_date", "search_knowledge_base"]);
    expect(requests[1]?.turns.at(-1)).toEqual({
      role: "user",
      parts: [
        { type: "toolResult", id: "c1", name: "check_date", result: { date: "2026-12-24", isWorkingDay: false } },
      ],
    });
    expect(requests[1]?.turns[0]).toEqual({ role: "model", parts: [{ type: "text", text: "Earlier answer" }] });
    expect(events).toEqual([
      { type: "tool", name: "check_date", status: "running" },
      { type: "tool", name: "check_date", status: "done" },
      { type: "delta", text: "No, it is not." },
    ]);
  });

  it("sends the instruction with the question without adding it to the answer", async () => {
    const { provider, requests } = scriptedProvider([[{ type: "text", text: "Ja." }]]);
    await runChat({
      provider,
      system: "system",
      promptVersion: "test",
      history: [],
      message: "Frage",
      instruction: "(Answer in German.)",
      context,
      tools,
      onEvent: () => {},
    });
    expect(requests[0]?.turns).toEqual([
      {
        role: "user",
        parts: [
          { type: "text", text: "Frage" },
          { type: "text", text: "(Answer in German.)" },
        ],
      },
    ]);
  });

  it("reports invalid arguments and unknown tools back to the model instead of failing", async () => {
    const { provider, requests } = scriptedProvider([
      [
        { type: "toolCall", id: "a", name: "check_date", args: { date: "24.12.2026" } },
        { type: "toolCall", id: "b", name: "delete_everything", args: {} },
      ],
      [{ type: "text", text: "Sorry." }],
    ]);

    const answer = await run(provider);

    const results = requests[1]?.turns.at(-1)?.parts ?? [];
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ type: "toolResult", result: { error: expect.stringContaining("Invalid") } });
    expect(results[1]).toMatchObject({ type: "toolResult", result: { error: "Unknown tool: delete_everything" } });
    // Only known tools are shown to the user
    expect(answer.toolCalls).toEqual([{ name: "check_date", ok: false }]);
  });

  it("collects knowledge base sources once and separates text from different rounds", async () => {
    const { provider } = scriptedProvider([
      [
        { type: "text", text: "Let me look that up." },
        { type: "toolCall", name: "search_knowledge_base", args: { query: "Widerspruch" } },
      ],
      [{ type: "toolCall", name: "search_knowledge_base", args: { query: "Frist" } }],
      [{ type: "text", text: "One month." }],
    ]);

    const answer = await run(provider);

    expect(answer.text).toBe("Let me look that up.\n\nOne month.");
    expect(answer.sources).toHaveLength(1);
    expect(events.filter((e) => (e as { type: string }).type === "delta")).toEqual([
      { type: "delta", text: "Let me look that up." },
      { type: "delta", text: "\n\n" },
      { type: "delta", text: "One month." },
    ]);
  });

  it("forces a text answer after too many tool rounds", async () => {
    const call = { type: "toolCall" as const, name: "check_date", args: { date: "2026-12-24" } };
    const { provider, requests } = scriptedProvider([
      ...Array.from({ length: MAX_TOOL_ROUNDS }, () => [call]),
      [{ type: "text", text: "Enough checking." }],
    ]);

    const answer = await run(provider);

    expect(answer.text).toBe("Enough checking.");
    expect(requests).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(requests.map((r) => r.toolChoice)).toEqual([...Array(MAX_TOOL_ROUNDS).fill("auto"), "none"]);
  });
});
