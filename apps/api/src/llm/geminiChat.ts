import type { Content, Part } from "@google/genai";
import type { ChatPart, ChatRoundResult, ChatTurn } from "./LLMProvider";

/**
 * Gemini's documented placeholder for a function call whose thought signature is unknown,
 * e.g. one written by another model after a switch to the fallback model. Thinking models
 * reject function calls in the current turn that come without a signature.
 */
export const SKIP_SIGNATURE = "skip_thought_signature_validator";

/** Converts a provider-neutral chat into Gemini contents for `model` */
export function toGeminiContents(turns: ChatTurn[], model: string): Content[] {
  return turns.map((turn) => {
    // Signatures belong to the model that wrote them
    const sameModel = turn.model === model;
    const parts = turn.parts.map((part): Part => {
      switch (part.type) {
        case "text":
          return sameModel && part.signature ? { text: part.text, thoughtSignature: part.signature } : { text: part.text };
        case "toolCall":
          return {
            functionCall: { id: part.id, name: part.name, args: part.args },
            thoughtSignature: sameModel && part.signature ? part.signature : SKIP_SIGNATURE,
          };
        case "toolResult":
          return { functionResponse: { id: part.id, name: part.name, response: part.result } };
      }
    });
    return { role: turn.role, parts };
  });
}

type ModelPart = ChatRoundResult["parts"][number];
type TextPart = Extract<ChatPart, { type: "text" }>;

/**
 * Collects the parts of a streamed answer. Text arrives in many chunks and is joined into
 * one part; a function call arrives whole. Thought signatures are kept with their part.
 */
export class StreamedParts {
  readonly parts: ModelPart[] = [];

  /** Adds the parts of one chunk and returns the new visible text */
  add(parts: Part[] | undefined): string {
    let text = "";
    for (const part of parts ?? []) {
      if (part.thought) continue; // thought summaries are not part of the answer
      if (part.functionCall?.name) {
        this.parts.push({
          type: "toolCall",
          id: part.functionCall.id,
          name: part.functionCall.name,
          args: part.functionCall.args ?? {},
          signature: part.thoughtSignature,
        });
        continue;
      }
      if (part.text === undefined && !part.thoughtSignature) continue;

      let current = this.parts.at(-1);
      if (current?.type !== "text") {
        current = { type: "text", text: "" } satisfies TextPart;
        this.parts.push(current);
      }
      current.text += part.text ?? "";
      if (part.thoughtSignature) current.signature = part.thoughtSignature;
      text += part.text ?? "";
    }
    return text;
  }
}
