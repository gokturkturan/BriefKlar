import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { isRetryableStatus, LLMError, userErrorForStatus } from "./errors";
import type {
  JsonGenerationRequest,
  JsonGenerationResult,
  LLMInputPart,
  LLMProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from "./LLMProvider";

function toGeminiPart(part: LLMInputPart): Part {
  if (part.type === "text") return { text: part.text };
  // PDFs (including scanned ones) and images are sent inline: Gemini reads them natively,
  // so no separate OCR / PDF parsing step is needed. Inline data is fine for our 10 MB limit.
  return { inlineData: { mimeType: part.mimeType, data: part.data.toString("base64") } };
}

function toLLMError(err: unknown, model: string): LLMError {
  if (err instanceof LLMError) return err;
  const status = err instanceof ApiError ? err.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const userError = userErrorForStatus(status);
  return new LLMError(
    `Gemini (${model}) failed${status ? ` with ${status}` : ""}: ${message}`,
    isRetryableStatus(status),
    userError.message,
    userError.code,
    status,
    model,
  );
}

/** After the primary model is overloaded, skip it for a while instead of waiting for it to fail again */
const PRIMARY_COOLDOWN_MS = 2 * 60 * 1000;

/** Longest wait for the first chunk of a streamed answer */
const FIRST_CHUNK_TIMEOUT_MS = 20_000;

/** Longest wait for a complete JSON answer (reading a scanned letter takes a while) */
const JSON_TIMEOUT_MS = 60_000;

function timeoutError(model: string, ms: number): LLMError {
  const { message, code } = userErrorForStatus(504);
  return new LLMError(`Gemini (${model}) did not answer within ${ms / 1000} s`, true, message, code, 504, model);
}

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
    return this.withFallback((model) => this.call(model, request));
  }

  async streamText(
    request: TextGenerationRequest,
    onDelta: (text: string) => void,
  ): Promise<TextGenerationResult> {
    let started = false;
    const emit = (text: string) => {
      started = true;
      onDelta(text);
    };
    // Once text has reached the user, switching to another model would mix two answers
    return this.withFallback((model) => this.stream(model, request, emit), () => !started);
  }

  /**
   * Simple circuit breaker: after the primary model is overloaded or rate limited, the
   * fallback model answers for a while instead of waiting for the primary to fail again.
   */
  private async withFallback<T>(
    run: (model: string) => Promise<T>,
    canFallBack: () => boolean = () => true,
  ): Promise<T> {
    if (this.fallbackModel && Date.now() < this.primaryCooldownUntil) {
      try {
        return await run(this.fallbackModel);
      } catch (err) {
        throw toLLMError(err, this.fallbackModel);
      }
    }

    try {
      return await run(this.model);
    } catch (err) {
      const error = toLLMError(err, this.model);
      // Overload (503) and quota (429) are per model, so a smaller model often still works.
      // A timeout (504) usually means the same overload, without an error from the API
      const overloaded = [429, 503, 504].includes(error.statusCode ?? 0);
      if (!this.fallbackModel || !overloaded || !canFallBack()) throw error;

      this.primaryCooldownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
      console.warn(`${error.message} -> using ${this.fallbackModel} for the next ${PRIMARY_COOLDOWN_MS / 60000} min`);
      try {
        return await run(this.fallbackModel);
      } catch (fallbackErr) {
        throw toLLMError(fallbackErr, this.fallbackModel);
      }
    }
  }

  private async stream(
    model: string,
    request: TextGenerationRequest,
    onDelta: (text: string) => void,
  ): Promise<TextGenerationResult> {
    // A model can stay silent for a long time when it is overloaded. Waiting longer than
    // FIRST_CHUNK_TIMEOUT_MS for the first chunk counts as a timeout, so the fallback can answer.
    const timeout = new AbortController();
    const signal = request.signal ? AbortSignal.any([request.signal, timeout.signal]) : timeout.signal;
    const timer = setTimeout(() => timeout.abort(), FIRST_CHUNK_TIMEOUT_MS);

    let text = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const stream = await this.client.models.generateContentStream({
        model,
        contents: [{ role: "user", parts: request.input.map(toGeminiPart) }],
        config: {
          systemInstruction: request.system,
          temperature: 0.3, // explanations may vary a little, facts come from the letter
          abortSignal: signal,
        },
      });

      for await (const chunk of stream) {
        clearTimeout(timer);
        const delta = chunk.text ?? "";
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        // Usage is reported with the chunks; the last one has the totals
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
      }
    } catch (err) {
      if (timeout.signal.aborted && !request.signal?.aborted) throw timeoutError(model, FIRST_CHUNK_TIMEOUT_MS);
      throw err;
    } finally {
      clearTimeout(timer);
    }
    return { text, model, inputTokens, outputTokens };
  }

  private async call(model: string, request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    // Without a limit, a request to an overloaded model can hang for minutes
    const timeoutMs = request.timeoutMs ?? JSON_TIMEOUT_MS;
    const timeout = AbortSignal.timeout(timeoutMs);
    let response;
    try {
      response = await this.client.models.generateContent({
        model,
        contents: [{ role: "user", parts: request.input.map(toGeminiPart) }],
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
          temperature: 0, // extraction should be as deterministic as possible
          abortSignal: timeout,
        },
      });
    } catch (err) {
      if (timeout.aborted) throw timeoutError(model, timeoutMs);
      throw err;
    }

    return {
      text: response.text ?? "",
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
