import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { isRetryableStatus, LLMError, userMessageForStatus } from "./errors";
import type {
  JsonGenerationRequest,
  JsonGenerationResult,
  LLMInputPart,
  LLMProvider,
} from "./LLMProvider";

function toGeminiPart(part: LLMInputPart): Part {
  if (part.type === "text") return { text: part.text };
  // PDFs (including scanned ones) and images are sent inline: Gemini reads them natively,
  // so no separate OCR / PDF parsing step is needed. Inline data is fine for our 10 MB limit.
  return { inlineData: { mimeType: part.mimeType, data: part.data.toString("base64") } };
}

function toLLMError(err: unknown, model: string): LLMError {
  const status = err instanceof ApiError ? err.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  return new LLMError(
    `Gemini (${model}) failed${status ? ` with ${status}` : ""}: ${message}`,
    isRetryableStatus(status),
    userMessageForStatus(status),
    status,
    model,
  );
}

/** After the primary model is overloaded, skip it for a while instead of waiting for it to fail again */
const PRIMARY_COOLDOWN_MS = 2 * 60 * 1000;

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;
  private primaryCooldownUntil = 0;

  constructor(
    apiKey: string,
    readonly model: string,
    /** Used when the primary model is overloaded or rate limited */
    private readonly fallbackModel?: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateJson(request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    // Simple circuit breaker: while the primary model is cooling down, go straight to the fallback
    if (this.fallbackModel && Date.now() < this.primaryCooldownUntil) {
      try {
        return await this.call(this.fallbackModel, request);
      } catch (err) {
        throw toLLMError(err, this.fallbackModel);
      }
    }

    try {
      return await this.call(this.model, request);
    } catch (err) {
      const error = toLLMError(err, this.model);
      // Overload (503) and quota (429) are per model, so a smaller model often still works
      const canFallBack = error.statusCode === 503 || error.statusCode === 429;
      if (!this.fallbackModel || !canFallBack) throw error;

      this.primaryCooldownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
      console.warn(`${error.message} -> using ${this.fallbackModel} for the next ${PRIMARY_COOLDOWN_MS / 60000} min`);
      try {
        return await this.call(this.fallbackModel, request);
      } catch (fallbackErr) {
        throw toLLMError(fallbackErr, this.fallbackModel);
      }
    }
  }

  private async call(model: string, request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    const response = await this.client.models.generateContent({
      model,
      contents: [{ role: "user", parts: request.input.map(toGeminiPart) }],
      config: {
        systemInstruction: request.system,
        responseMimeType: "application/json",
        responseJsonSchema: request.jsonSchema,
        temperature: 0, // extraction should be as deterministic as possible
      },
    });

    return {
      text: response.text ?? "",
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
