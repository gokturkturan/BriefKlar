import Anthropic from "@anthropic-ai/sdk";
import { isRetryableStatus, LLMError, userErrorForStatus } from "./errors";
import { FallbackRunner, type FallbackResult } from "./fallback";
import type {
  ChatPart,
  ChatRoundRequest,
  ChatRoundResult,
  ChatTurn,
  EmbeddingRequest,
  EmbeddingResult,
  JsonGenerationRequest,
  JsonGenerationResult,
  LLMInputPart,
  LLMProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from "./LLMProvider";

/** Longest wait for a complete JSON answer (reading a scanned letter takes a while) */
const JSON_TIMEOUT_MS = 90_000;
/** Longest wait for the first event of a streamed answer */
const FIRST_CHUNK_TIMEOUT_MS = 30_000;
/** Room for the answer and the model's thinking; letters and chat answers are far shorter */
const MAX_TOKENS = 16_000;

interface Usage {
  inputTokens: number;
  outputTokens: number;
}

function usageOf(usage: Anthropic.Usage): Usage {
  return {
    inputTokens:
      usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    // Thinking tokens are billed as output and already counted in output_tokens
    outputTokens: usage.output_tokens,
  };
}

function toLLMError(err: unknown, model: string): LLMError {
  if (err instanceof LLMError) return err;
  const status = err instanceof Anthropic.APIError ? err.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const userError = userErrorForStatus(status);
  return new LLMError(
    `Claude (${model}) failed${status ? ` with ${status}` : ""}: ${message}`,
    isRetryableStatus(status),
    userError.message,
    userError.code,
    status,
    model,
  );
}

function timeoutError(model: string, ms: number): LLMError {
  const { message, code } = userErrorForStatus(504);
  return new LLMError(`Claude (${model}) did not answer within ${ms / 1000} s`, true, message, code, 504, model);
}

/** A refusal is the model's decision about this input: trying again gives the same answer */
function refusalError(model: string, message: Anthropic.Message): LLMError {
  return new LLMError(
    `Claude (${model}) declined the request (${message.stop_details?.category ?? "no category"})`,
    false,
    userErrorForStatus(undefined).message,
    "AI_FAILED",
    undefined,
    model,
  );
}

/** PDFs (also scanned ones) and images are sent inline; Claude reads both natively */
export function toClaudeBlock(part: LLMInputPart): Anthropic.ContentBlockParam {
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.mimeType === "text/plain") {
    return { type: "document", source: { type: "text", media_type: "text/plain", data: part.data.toString("utf8") } };
  }
  const data = part.data.toString("base64");
  if (part.mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: part.mimeType as "image/jpeg" | "image/png", data },
  };
}

/** Claude needs an id on every tool call; calls from a model without ids get one here */
const fallbackToolId = (turn: number, index: number) => `toolu_bk_${turn}_${index}`;

/**
 * Converts a provider-neutral chat into Claude messages for `model`. A turn this model wrote
 * is sent back exactly as it came (with its thinking blocks); other turns are rebuilt from
 * their parts. Tool results are matched to the calls of the turn before them.
 */
export function toClaudeMessages(turns: ChatTurn[], model: string): Anthropic.MessageParam[] {
  let lastCallIds: { name: string; id: string }[] = [];
  return turns.map((turn, turnIndex): Anthropic.MessageParam => {
    if (turn.role === "model") {
      if (turn.model === model && Array.isArray(turn.raw)) {
        const content = turn.raw as Anthropic.ContentBlockParam[];
        lastCallIds = content.flatMap((b) => (b.type === "tool_use" ? [{ name: b.name, id: b.id }] : []));
        return { role: "assistant", content };
      }
      lastCallIds = [];
      const content = turn.parts.map((part, index): Anthropic.ContentBlockParam => {
        if (part.type === "toolCall") {
          const id = part.id ?? fallbackToolId(turnIndex, index);
          lastCallIds.push({ name: part.name, id });
          return { type: "tool_use", id, name: part.name, input: part.args };
        }
        return { type: "text", text: part.type === "text" ? part.text : "" };
      });
      return { role: "assistant", content: content.filter((b) => b.type !== "text" || b.text !== "") };
    }

    const open = [...lastCallIds];
    const content = turn.parts.map((part): Anthropic.ContentBlockParam => {
      if (part.type === "toolResult") {
        const match = open.findIndex((call) => (part.id ? call.id === part.id : call.name === part.name));
        const id = match >= 0 ? open.splice(match, 1)[0].id : (part.id ?? part.name);
        return { type: "tool_result", tool_use_id: id, content: JSON.stringify(part.result) };
      }
      return { type: "text", text: part.type === "text" ? part.text : "" };
    });
    lastCallIds = [];
    return { role: "user", content };
  });
}

/** The visible text and tool calls of an answer, in order */
export function partsOf(content: Anthropic.ContentBlock[]): ChatRoundResult["parts"] {
  const parts: ChatRoundResult["parts"] = [];
  for (const block of content) {
    if (block.type === "text") {
      const last = parts.at(-1);
      if (last?.type === "text") last.text += block.text;
      else parts.push({ type: "text", text: block.text } satisfies Extract<ChatPart, { type: "text" }>);
    } else if (block.type === "tool_use") {
      parts.push({ type: "toolCall", id: block.id, name: block.name, args: (block.input ?? {}) as Record<string, unknown> });
    }
  }
  return parts;
}

function withMeta<T extends Usage>({ value, model, latencyMs, failedAttempts }: FallbackResult<T>) {
  return { ...value, model, latencyMs, failedAttempts };
}

/** Claude through the Anthropic API (e.g. claude-haiku-5-5). Has no embedding model. */
export class ClaudeProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly embeddingModel = "";
  private readonly client: Anthropic;
  private readonly models: FallbackRunner;

  constructor(
    apiKey: string,
    readonly model: string,
    /** Used when the primary model is overloaded or rate limited */
    fallbackModel?: string,
  ) {
    // Retries are the job of the fallback runner and the BullMQ job, not of the SDK
    this.client = new Anthropic({ apiKey, maxRetries: 0 });
    this.models = new FallbackRunner(model, fallbackModel, toLLMError);
  }

  async generateJson(request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    return withMeta(
      await this.models.run(async (model) => {
        const timeoutMs = request.timeoutMs ?? JSON_TIMEOUT_MS;
        const timeout = AbortSignal.timeout(timeoutMs);
        let message: Anthropic.Message;
        try {
          message = await this.client.messages.create(
            {
              model,
              max_tokens: MAX_TOKENS,
              system: request.system,
              messages: [{ role: "user", content: request.input.map(toClaudeBlock) }],
              output_config: { format: { type: "json_schema", schema: request.jsonSchema } },
            },
            { signal: timeout },
          );
        } catch (err) {
          if (timeout.aborted) throw timeoutError(model, timeoutMs);
          throw err;
        }
        if (message.stop_reason === "refusal") throw refusalError(model, message);
        const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        return { text, ...usageOf(message.usage) };
      }),
    );
  }

  async streamText(request: TextGenerationRequest, onDelta: (text: string) => void): Promise<TextGenerationResult> {
    return this.runStreaming(onDelta, async (model, emit) => {
      let text = "";
      const message = await this.stream(
        model,
        { system: request.system, messages: [{ role: "user", content: request.input.map(toClaudeBlock) }] },
        request.signal,
        (delta) => {
          text += delta;
          emit(delta);
        },
      );
      return { text, ...usageOf(message.usage) };
    });
  }

  async chatRound(request: ChatRoundRequest, onDelta: (text: string) => void): Promise<ChatRoundResult> {
    return this.runStreaming(onDelta, async (model, emit) => {
      const message = await this.stream(
        model,
        {
          system: request.system,
          messages: toClaudeMessages(request.turns, model),
          tools: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters as Anthropic.Tool.InputSchema,
          })),
          tool_choice: { type: request.toolChoice === "none" ? "none" : "auto" },
        },
        request.signal,
        emit,
      );
      // A call cut off at max_tokens has incomplete arguments: answer with the text only
      const parts = partsOf(message.content).filter((p) => p.type === "text" || message.stop_reason !== "max_tokens");
      return { parts, raw: message.content, ...usageOf(message.usage) };
    });
  }

  async embed(_request: EmbeddingRequest): Promise<EmbeddingResult> {
    throw new LLMError(
      "Anthropic has no embedding model: set LLM_EMBEDDING_PROVIDER to openai or gemini",
      false,
      userErrorForStatus(undefined).message,
      "AI_FAILED",
      undefined,
      this.model,
    );
  }

  /** Same rule as the Gemini provider: no switch of model after text reached the user */
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
   * Streams one answer and passes the text to `onText`. Waiting longer than the first-chunk
   * timeout for the first event counts as a timeout, so the fallback model can answer instead.
   */
  private async stream(
    model: string,
    params: Omit<Anthropic.MessageStreamParams, "model" | "max_tokens">,
    signal: AbortSignal | undefined,
    onText: (text: string) => void,
  ): Promise<Anthropic.Message> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), FIRST_CHUNK_TIMEOUT_MS);
    try {
      const stream = this.client.messages.stream(
        { ...params, model, max_tokens: MAX_TOKENS },
        { signal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal },
      );
      for await (const event of stream) {
        clearTimeout(timer);
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") onText(event.delta.text);
      }
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw refusalError(model, message);
      return message;
    } catch (err) {
      if (timeout.signal.aborted && !signal?.aborted) throw timeoutError(model, FIRST_CHUNK_TIMEOUT_MS);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
