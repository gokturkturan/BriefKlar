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
  model: string;
  inputTokens: number;
  outputTokens: number;
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
}
