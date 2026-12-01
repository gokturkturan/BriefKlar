import type { FailedAttempt } from "./fallback";

/**
 * Provider-agnostic interface. The rest of the app never imports a vendor SDK directly,
 * so switching from Gemini to Claude (or anything else) means adding one class.
 */

export type LLMInputPart =
  | { type: "text"; text: string }
  | { type: "file"; mimeType: string; data: Buffer };

export interface JsonGenerationRequest {
  system: string;
  input: LLMInputPart[];
  /** JSON Schema the model's output must follow */
  jsonSchema: Record<string, unknown>;
  /** Longest wait for the answer; the provider has a default for reading whole letters */
  timeoutMs?: number;
}

export interface JsonGenerationResult {
  /** Raw model output, expected to be a JSON string (validated by the caller) */
  text: string;
  /** The model that actually answered (may be a fallback model) */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** How long the answering model took */
  latencyMs: number;
  /** Models that failed before the one that answered (the primary, after a switch to the fallback) */
  failedAttempts: FailedAttempt[];
}

export interface TextGenerationRequest {
  system: string;
  input: LLMInputPart[];
  /** Aborts the request, e.g. when the browser closes the stream */
  signal?: AbortSignal;
}

export interface TextGenerationResult {
  /** The full text, i.e. all chunks joined */
  text: string;
  /** The model that actually answered (may be a fallback model) */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** How long the answering model took */
  latencyMs: number;
  /** Models that failed before the one that answered (the primary, after a switch to the fallback) */
  failedAttempts: FailedAttempt[];
}

/** One piece of a chat turn: text, a tool call by the model, or the result the app sends back */
export type ChatPart =
  | {
      type: "text";
      text: string;
      /** Provider data that must be sent back unchanged (Gemini thought signatures) */
      signature?: string;
    }
  | { type: "toolCall"; id?: string; name: string; args: Record<string, unknown>; signature?: string }
  | { type: "toolResult"; id?: string; name: string; result: Record<string, unknown> };

export interface ChatTurn {
  role: "user" | "model";
  parts: ChatPart[];
  /** Model that wrote a model turn; signatures are only valid for the same model */
  model?: string;
}

/** A function the model may call; parameters are a JSON Schema object */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRoundRequest {
  system: string;
  turns: ChatTurn[];
  tools: ToolDeclaration[];
  /** "none" forces a text answer, e.g. after too many tool rounds */
  toolChoice?: "auto" | "none";
  signal?: AbortSignal;
}

export interface ChatRoundResult {
  /** Text and tool calls of the model's turn, in order */
  parts: Extract<ChatPart, { type: "text" | "toolCall" }>[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  failedAttempts: FailedAttempt[];
}

export interface EmbeddingRequest {
  texts: string[];
  /** Documents are stored in the knowledge base, queries are searched with */
  kind: "document" | "query";
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  /** One unit-length vector per text, in the same order */
  vectors: number[][];
  model: string;
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: string;
  /** Primary model */
  readonly model: string;
  /** Throws LLMError on failure */
  generateJson(request: JsonGenerationRequest): Promise<JsonGenerationResult>;
  /**
   * Generates free text and calls onDelta for every chunk as soon as it arrives.
   * Throws LLMError on failure (also after some chunks were already delivered).
   */
  streamText(
    request: TextGenerationRequest,
    onDelta: (text: string) => void,
  ): Promise<TextGenerationResult>;
  /**
   * One round of a chat with tools: the model either answers (text is streamed through
   * onDelta) or asks for tool calls, which the caller runs and sends back in the next round.
   */
  chatRound(request: ChatRoundRequest, onDelta: (text: string) => void): Promise<ChatRoundResult>;
  /** Embedding model; vectors from different models cannot be compared */
  readonly embeddingModel: string;
  /** Turns texts into vectors of EMBEDDING_DIMENSIONS for semantic search. Throws LLMError on failure. */
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}

/** Length of every embedding; the knowledge base column is vector(1536) */
export const EMBEDDING_DIMENSIONS = 1536;
