import OpenAI from "openai";
import { isRetryableStatus, LLMError, userErrorForStatus } from "./errors";
import { FallbackRunner, type FallbackResult } from "./fallback";
import {
  EMBEDDING_DIMENSIONS,
  type ChatRoundRequest,
  type ChatRoundResult,
  type ChatTurn,
  type EmbeddingRequest,
  type EmbeddingResult,
  type JsonGenerationRequest,
  type JsonGenerationResult,
  type LLMInputPart,
  type LLMProvider,
  type TextGenerationRequest,
  type TextGenerationResult,
} from "./LLMProvider";
import { normalize } from "./vectors";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

/** Longest wait for a complete JSON answer (reading a scanned letter takes a while) */
const JSON_TIMEOUT_MS = 90_000;
/** Longest wait for the first chunk of a streamed answer */
const FIRST_CHUNK_TIMEOUT_MS = 30_000;
/** Longest wait for embeddings (short texts, so this is generous) */
const EMBEDDING_TIMEOUT_MS = 30_000;

interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** Reasoning tokens are billed as output and already counted in completion_tokens */
function usageOf(usage: OpenAI.CompletionUsage | null | undefined): Usage {
  return { inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
}

function toLLMError(err: unknown, model: string): LLMError {
  if (err instanceof LLMError) return err;
  const status = err instanceof OpenAI.APIError ? err.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const userError = userErrorForStatus(status);
  return new LLMError(
    `OpenAI (${model}) failed${status ? ` with ${status}` : ""}: ${message}`,
    isRetryableStatus(status),
    userError.message,
    userError.code,
    status,
    model,
  );
}

function timeoutError(model: string, ms: number): LLMError {
  const { message, code } = userErrorForStatus(504);
  return new LLMError(`OpenAI (${model}) did not answer within ${ms / 1000} s`, true, message, code, 504, model);
}

/** PDFs go as a file part, images as a data URL */
export function toOpenAIPart(part: LLMInputPart): ContentPart {
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.mimeType === "text/plain") return { type: "text", text: part.data.toString("utf8") };
  const dataUrl = `data:${part.mimeType};base64,${part.data.toString("base64")}`;
  if (part.mimeType === "application/pdf") {
    return { type: "file", file: { filename: "letter.pdf", file_data: dataUrl } };
  }
  return { type: "image_url", image_url: { url: dataUrl } };
}

/** OpenAI needs an id on every tool call; calls from a model without ids get one here */
const fallbackToolId = (turn: number, index: number) => `call_bk_${turn}_${index}`;

/** Converts a provider-neutral chat into OpenAI chat messages (after the system message) */
export function toOpenAIMessages(turns: ChatTurn[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let lastCallIds: { name: string; id: string }[] = [];
  turns.forEach((turn, turnIndex) => {
    if (turn.role === "model") {
      lastCallIds = [];
      const text = turn.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("");
      const toolCalls = turn.parts.flatMap((part, index) => {
        if (part.type !== "toolCall") return [];
        const id = part.id ?? fallbackToolId(turnIndex, index);
        lastCallIds.push({ name: part.name, id });
        return [{ id, type: "function" as const, function: { name: part.name, arguments: JSON.stringify(part.args) } }];
      });
      messages.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
      return;
    }

    const open = [...lastCallIds];
    const text: string[] = [];
    for (const part of turn.parts) {
      if (part.type === "toolResult") {
        const match = open.findIndex((call) => (part.id ? call.id === part.id : call.name === part.name));
        const id = match >= 0 ? open.splice(match, 1)[0].id : (part.id ?? part.name);
        messages.push({ role: "tool", tool_call_id: id, content: JSON.stringify(part.result) });
      } else if (part.type === "text") {
        text.push(part.text);
      }
    }
    if (text.length > 0) messages.push({ role: "user", content: text.join("\n\n") });
    lastCallIds = [];
  });
  return messages;
}

/** The visible text and tool calls of an answer, in order */
export function partsOf(message: OpenAI.Chat.Completions.ChatCompletionMessage): ChatRoundResult["parts"] {
  const parts: ChatRoundResult["parts"] = [];
  if (message.content) parts.push({ type: "text", text: message.content });
  for (const call of message.tool_calls ?? []) {
    if (call.type !== "function") continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    } catch {
      // Invalid arguments: the tool's schema check answers with an error the model can fix
    }
    parts.push({ type: "toolCall", id: call.id, name: call.function.name, args });
  }
  return parts;
}

function withMeta<T extends Usage>({ value, model, latencyMs, failedAttempts }: FallbackResult<T>) {
  return { ...value, model, latencyMs, failedAttempts };
}

/** OpenAI models through the Chat Completions API (e.g. gpt-6-luna), and OpenAI embeddings */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly models: FallbackRunner;

  constructor(
    apiKey: string,
    readonly model: string,
    /** Used when the primary model is overloaded or rate limited */
    fallbackModel?: string,
    readonly embeddingModel = "text-embedding-3-small",
  ) {
    // Retries are the job of the fallback runner and the BullMQ job, not of the SDK
    this.client = new OpenAI({ apiKey, maxRetries: 0 });
    this.models = new FallbackRunner(model, fallbackModel, toLLMError);
  }

  async generateJson(request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    return withMeta(
      await this.models.run(async (model) => {
        const timeoutMs = request.timeoutMs ?? JSON_TIMEOUT_MS;
        const timeout = AbortSignal.timeout(timeoutMs);
        try {
          const completion = await this.client.chat.completions.create(
            {
              model,
              messages: [
                { role: "system", content: request.system },
                { role: "user", content: request.input.map(toOpenAIPart) },
              ],
              // Not strict: strict mode needs every property required, which our schemas do not
              // follow. The answer is validated with Zod afterwards (generateStructured.ts).
              response_format: {
                type: "json_schema",
                json_schema: { name: "answer", schema: request.jsonSchema, strict: false },
              },
            },
            { signal: timeout },
          );
          return { text: completion.choices[0]?.message.content ?? "", ...usageOf(completion.usage) };
        } catch (err) {
          if (timeout.aborted) throw timeoutError(model, timeoutMs);
          throw err;
        }
      }),
    );
  }

  async streamText(request: TextGenerationRequest, onDelta: (text: string) => void): Promise<TextGenerationResult> {
    return this.runStreaming(onDelta, async (model, emit) => {
      let text = "";
      const completion = await this.stream(
        model,
        [
          { role: "system", content: request.system },
          { role: "user", content: request.input.map(toOpenAIPart) },
        ],
        {},
        request.signal,
        (delta) => {
          text += delta;
          emit(delta);
        },
      );
      return { text, ...usageOf(completion.usage) };
    });
  }

  async chatRound(request: ChatRoundRequest, onDelta: (text: string) => void): Promise<ChatRoundResult> {
    return this.runStreaming(onDelta, async (model, emit) => {
      const completion = await this.stream(
        model,
        [{ role: "system", content: request.system }, ...toOpenAIMessages(request.turns)],
        {
          tools: request.tools.map((tool) => ({
            type: "function" as const,
            function: { name: tool.name, description: tool.description, parameters: tool.parameters },
          })),
          tool_choice: request.toolChoice === "none" ? "none" : "auto",
        },
        request.signal,
        emit,
      );
      const message = completion.choices[0]?.message;
      return { parts: message ? partsOf(message) : [], ...usageOf(completion.usage) };
    });
  }

  /** No fallback model here: vectors from two models live in different spaces */
  async embed({ texts, signal }: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = this.embeddingModel;
    const startedAt = Date.now();
    const timeout = AbortSignal.timeout(EMBEDDING_TIMEOUT_MS);
    try {
      const response = await this.client.embeddings.create(
        { model, input: texts, dimensions: EMBEDDING_DIMENSIONS },
        { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
      );
      const vectors = [...response.data].sort((a, b) => a.index - b.index).map((e) => e.embedding);
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new LLMError(
          `OpenAI (${model}) returned ${vectors.length} embeddings for ${texts.length} texts`,
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

  /** Same rule as the other providers: no switch of model after text reached the user */
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

  private async stream(
    model: string,
    messages: ChatMessage[],
    extra: Partial<Pick<OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming, "tools" | "tool_choice">>,
    signal: AbortSignal | undefined,
    onText: (text: string) => void,
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), FIRST_CHUNK_TIMEOUT_MS);
    try {
      const stream = this.client.chat.completions.stream(
        { model, messages, ...extra, stream_options: { include_usage: true } },
        { signal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal },
      );
      for await (const chunk of stream) {
        clearTimeout(timer);
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) onText(delta);
      }
      return await stream.finalChatCompletion();
    } catch (err) {
      if (timeout.signal.aborted && !signal?.aborted) throw timeoutError(model, FIRST_CHUNK_TIMEOUT_MS);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
