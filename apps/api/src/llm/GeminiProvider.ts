import {
  ApiError,
  FunctionCallingConfigMode,
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type GenerateContentResponseUsageMetadata,
  type Part,
} from "@google/genai";
import { isRetryableStatus, LLMError, userErrorForStatus } from "./errors";
import { FallbackRunner, type FallbackResult } from "./fallback";
import { StreamedParts, toGeminiContents } from "./geminiChat";
import {
  EMBEDDING_DIMENSIONS,
  type ChatRoundRequest,
  type ChatRoundResult,
  type EmbeddingRequest,
  type EmbeddingResult,
  type JsonGenerationRequest,
  JsonGenerationResult,
  type LLMInputPart,
  type LLMProvider,
  type TextGenerationRequest,
  type TextGenerationResult,
} from "./LLMProvider";
import { normalize } from "./vectors";

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

/** Longest wait for the first chunk of a chat round; deciding on tool calls takes some thinking */
const CHAT_FIRST_CHUNK_TIMEOUT_MS = 30_000;

/** Longest wait for embeddings (short texts, so this is generous) */
const EMBEDDING_TIMEOUT_MS = 30_000;

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

/** Thinking tokens are billed as output, so they count as output */
function usageOf(meta: GenerateContentResponseUsageMetadata | undefined): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
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
    readonly embeddingModel = "gemini-embedding-001",
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
    return this.runStreaming(onDelta, async (model, emit) => {
      let text = "";
      const usage = await this.stream(
        model,
        {
          contents: [{ role: "user", parts: request.input.map(toGeminiPart) }],
          config: {
            systemInstruction: request.system,
            temperature: 0.3, // explanations may vary a little, facts come from the letter
          },
        },
        { signal: request.signal, firstChunkMs: FIRST_CHUNK_TIMEOUT_MS },
        (chunk) => {
          const delta = chunk.text ?? "";
          if (!delta) return;
          text += delta;
          emit(delta);
        },
      );
      return { text, ...usage };
    });
  }

  async chatRound(request: ChatRoundRequest, onDelta: (text: string) => void): Promise<ChatRoundResult> {
    return this.runStreaming(onDelta, async (model, emit) => {
      const collected = new StreamedParts();
      const usage = await this.stream(
        model,
        {
          contents: toGeminiContents(request.turns, model),
          config: {
            systemInstruction: request.system,
            tools: [
              {
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parametersJsonSchema: tool.parameters,
                })),
              },
            ],
            toolConfig: {
              functionCallingConfig: {
                mode: request.toolChoice === "none" ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.AUTO,
              },
            },
          },
        },
        { signal: request.signal, firstChunkMs: CHAT_FIRST_CHUNK_TIMEOUT_MS },
        (chunk) => {
          const delta = collected.add(chunk.candidates?.[0]?.content?.parts);
          if (delta) emit(delta);
        },
      );
      return { parts: collected.parts, ...usage };
    });
  }

  /**
   * Runs a streamed answer on the primary model, or on the fallback model if the primary is
   * overloaded. Once text has reached the user, switching models would mix two answers, so a
   * failure after that is thrown; a chat round that only asked for tools can still switch.
   */
  private async runStreaming<T extends Usage>(
    onDelta: (text: string) => void,
    answer: (model: string, emit: (text: string) => void) => Promise<T>,
  ) {
    let started = false;
    const emit = (text: string) => {
      started = true;
      onDelta(text);
    };
    return withMeta(await this.models.run((model) => answer(model, emit), () => !started));
  }

  /**
   * Streams one answer from `model` and passes every chunk to `onChunk`. A model can stay
   * silent for a long time when it is overloaded: waiting longer than `firstChunkMs` for the
   * first chunk counts as a timeout, so the fallback model can answer instead.
   */
  private async stream(
    model: string,
    { contents, config }: Pick<GenerateContentParameters, "contents" | "config">,
    { signal, firstChunkMs }: { signal?: AbortSignal; firstChunkMs: number },
    onChunk: (chunk: GenerateContentResponse) => void,
  ): Promise<Usage> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), firstChunkMs);
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const stream = await this.client.models.generateContentStream({
        model,
        contents,
        config: { ...config, abortSignal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal },
      });

      for await (const chunk of stream) {
        clearTimeout(timer);
        onChunk(chunk);
        // Usage is reported with the chunks; the last one has the totals
        if (chunk.usageMetadata) {
          const { inputTokens, outputTokens } = usageOf(chunk.usageMetadata);
          usage.inputTokens = inputTokens || usage.inputTokens;
          usage.outputTokens = outputTokens || usage.outputTokens;
        }
      }
    } catch (err) {
      if (timeout.signal.aborted && !signal?.aborted) throw timeoutError(model, firstChunkMs);
      throw err;
    } finally {
      clearTimeout(timer);
    }
    return usage;
  }

  /**
   * No fallback model here: vectors from two models live in different spaces, so a query
   * embedded by another model would not find the stored entries.
   */
  async embed({ texts, kind, signal }: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = this.embeddingModel;
    const startedAt = Date.now();
    const timeout = AbortSignal.timeout(EMBEDDING_TIMEOUT_MS);
    try {
      const response = await this.client.models.embedContent({
        model,
        contents: texts,
        config: {
          taskType: kind === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
          outputDimensionality: EMBEDDING_DIMENSIONS,
          abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        },
      });
      const vectors = (response.embeddings ?? []).map((e) => e.values ?? []);
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new LLMError(
          `Gemini (${model}) returned ${vectors.length} embeddings for ${texts.length} texts`,
          false,
          userErrorForStatus(undefined).message,
          "AI_FAILED",
          undefined,
          model,
        );
      }
      return { vectors: vectors.map(normalize), model, latencyMs: Date.now() - startedAt };
    } catch (err) {
      const error = timeout.aborted && !signal?.aborted ? timeoutError(model, EMBEDDING_TIMEOUT_MS) : toLLMError(err, model);
      error.latencyMs = Date.now() - startedAt;
      throw error;
    }
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

    return { text: response.text ?? "", ...usageOf(response.usageMetadata) };
  }
}
