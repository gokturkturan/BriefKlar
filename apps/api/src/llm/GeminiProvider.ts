import { ApiError, GoogleGenAI, type Part } from "@google/genai";
import { isRetryableStatus, LLMError, userErrorForStatus } from "./errors";
import { FallbackRunner, type FallbackResult } from "./fallback";
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

/** Longest wait for the first chunk of a streamed answer */
const FIRST_CHUNK_TIMEOUT_MS = 20_000;

/** Longest wait for a complete JSON answer (reading a scanned letter takes a while) */
const JSON_TIMEOUT_MS = 60_000;

function timeoutError(model: string, ms: number): LLMError {
  const { message, code } = userErrorForStatus(504);
  return new LLMError(`Gemini (${model}) did not answer within ${ms / 1000} s`, true, message, code, 504, model);
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** Adds the model, latency and failed attempts the fallback runner recorded */
function withMeta<T extends Usage>({ value, model, latencyMs, failedAttempts }: FallbackResult<T>) {
  return { ...value, model, latencyMs, failedAttempts };
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;
  private readonly models: FallbackRunner;

  constructor(
    apiKey: string,
    readonly model: string,
    /** Used when the primary model is overloaded or rate limited */
    fallbackModel?: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
    this.models = new FallbackRunner(model, fallbackModel, toLLMError);
  }

  async generateJson(request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    return withMeta(await this.models.run((model) => this.call(model, request)));
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
    return withMeta(await this.models.run((model) => this.stream(model, request, emit), () => !started));
  }

  private async stream(
    model: string,
    request: TextGenerationRequest,
    onDelta: (text: string) => void,
  ): Promise<{ text: string } & Usage> {
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
    return { text, inputTokens, outputTokens };
  }

  private async call(model: string, request: JsonGenerationRequest): Promise<{ text: string } & Usage> {
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
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
