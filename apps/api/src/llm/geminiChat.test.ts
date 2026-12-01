import { describe, expect, it } from "vitest";
import { SKIP_SIGNATURE, StreamedParts, toGeminiContents } from "./geminiChat";
import type { ChatTurn } from "./LLMProvider";

describe("toGeminiContents", () => {
  const turns: ChatTurn[] = [
    { role: "user", parts: [{ type: "text", text: "When is my deadline?" }] },
    {
      role: "model",
      model: "big",
      parts: [{ type: "toolCall", id: "c1", name: "get_letter_details", args: {}, signature: "sig-1" }],
    },
    { role: "user", parts: [{ type: "toolResult", id: "c1", name: "get_letter_details", result: { ok: 1 } }] },
  ];

  it("maps text, tool calls and tool results to Gemini parts", () => {
    expect(toGeminiContents(turns, "big")).toEqual([
      { role: "user", parts: [{ text: "When is my deadline?" }] },
      {
        role: "model",
        parts: [{ functionCall: { id: "c1", name: "get_letter_details", args: {} }, thoughtSignature: "sig-1" }],
      },
      { role: "user", parts: [{ functionResponse: { id: "c1", name: "get_letter_details", response: { ok: 1 } } }] },
    ]);
  });

  it("does not send one model's signatures to another model", () => {
    const [, modelTurn] = toGeminiContents(turns, "small");
    expect(modelTurn?.parts?.[0]?.thoughtSignature).toBe(SKIP_SIGNATURE);
  });

  it("drops text signatures for another model", () => {
    const contents = toGeminiContents(
      [{ role: "model", model: "big", parts: [{ type: "text", text: "Hi", signature: "s" }] }],
      "small",
    );
    expect(contents[0]?.parts).toEqual([{ text: "Hi" }]);
  });
});

describe("StreamedParts", () => {
  it("joins streamed text into one part and returns each chunk's visible text", () => {
    const parts = new StreamedParts();
    expect(parts.add([{ text: "Your dead" }])).toBe("Your dead");
    expect(parts.add([{ text: "line is " }, { text: "Monday." }])).toBe("line is Monday.");
    expect(parts.parts).toEqual([{ type: "text", text: "Your deadline is Monday." }]);
  });

  it("keeps tool calls whole, with their signature, between text parts", () => {
    const parts = new StreamedParts();
    parts.add([{ text: "Let me check." }]);
    parts.add([{ functionCall: { id: "1", name: "check_date", args: { date: "2026-12-24" } }, thoughtSignature: "x" }]);
    parts.add([{ text: "Done" }]);
    expect(parts.parts).toEqual([
      { type: "text", text: "Let me check." },
      { type: "toolCall", id: "1", name: "check_date", args: { date: "2026-12-24" }, signature: "x" },
      { type: "text", text: "Done" },
    ]);
  });

  it("keeps a signature that arrives on an empty text chunk, and skips thoughts", () => {
    const parts = new StreamedParts();
    parts.add([{ text: "Answer" }]);
    expect(parts.add([{ text: "thinking...", thought: true }, { text: "", thoughtSignature: "end" }])).toBe("");
    expect(parts.parts).toEqual([{ type: "text", text: "Answer", signature: "end" }]);
  });
});
