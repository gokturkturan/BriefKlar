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
}

export interface JsonGenerationResult {
  /** Raw model output, expected to be a JSON string (validated by the caller) */
  text: string;
  /** The model that actually answered (may be a fallback model) */
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
}
