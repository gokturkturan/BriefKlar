import { LLMError } from "./errors";
import { PRIMARY_COOLDOWN_MS, type FailedAttempt } from "./fallback";
import type {
  ChatRoundRequest,
  ChatRoundResult,
  EmbeddingRequest,
  EmbeddingResult,
  JsonGenerationRequest,
  JsonGenerationResult,
  LLMProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from "./LLMProvider";

/** Overload, quota and timeouts: another provider is likely to answer */
const SWITCH_STATUS = new Set([429, 500, 502, 503, 504, 529]);

interface Answer {
  model: string;
  provider?: string;
  failedAttempts: FailedAttempt[];
}

/**
 * Puts two providers behind one (e.g. Claude with OpenAI as the fallback) and takes the
 * embeddings from a third or one of them. Inside each provider, its own fallback model is tried
 * first; only when the whole provider is overloaded or down does the other provider answer,
 * and the primary is skipped for a while (same circuit breaker as fallback.ts).
 */
export class ProviderFallback implements LLMProvider {
  private primaryCooldownUntil = 0;

  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider | undefined,
    private readonly embeddings: LLMProvider,
    private readonly now: () => number = Date.now,
  ) {}

  get name() {
    return this.primary.name;
  }

  get model() {
    return this.primary.model;
  }

  get embeddingModel() {
    return this.embeddings.embeddingModel;
  }

  generateJson(request: JsonGenerationRequest): Promise<JsonGenerationResult> {
    return this.run((provider) => provider.generateJson(request));
  }

  streamText(request: TextGenerationRequest, onDelta: (text: string) => void): Promise<TextGenerationResult> {
    let started = false;
    const emit = (text: string) => {
      started = true;
      onDelta(text);
    };
    return this.run((provider) => provider.streamText(request, emit), () => !started);
  }

  chatRound(request: ChatRoundRequest, onDelta: (text: string) => void): Promise<ChatRoundResult> {
    let started = false;
    const emit = (text: string) => {
      started = true;
      onDelta(text);
    };
    return this.run((provider) => provider.chatRound(request, emit), () => !started);
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return this.embeddings.embed(request);
  }

  private async run<R extends Answer>(
    call: (provider: LLMProvider) => Promise<R>,
    canSwitch: () => boolean = () => true,
  ): Promise<R> {
    const { primary, fallback } = this;
    const viaFallback = async (failed: FailedAttempt[]): Promise<R> => {
      try {
        const result = await call(fallback!);
        return {
          ...result,
          provider: fallback!.name,
          failedAttempts: [...failed, ...result.failedAttempts.map((a) => ({ ...a, provider: fallback!.name }))],
        };
      } catch (err) {
        if (err instanceof LLMError) err.failedAttempts = [...failed, ...err.failedAttempts];
        throw err;
      }
    };

    if (fallback && this.now() < this.primaryCooldownUntil) return viaFallback([]);

    try {
      return await call(primary);
    } catch (err) {
      // A network error has no status; a refusal or a bad request is not retryable and stays
      const switchable =
        err instanceof LLMError && err.retryable && (err.statusCode === undefined || SWITCH_STATUS.has(err.statusCode));
      if (!fallback || !switchable || !canSwitch()) throw err;

      this.primaryCooldownUntil = this.now() + PRIMARY_COOLDOWN_MS;
      console.warn(`${err.message} -> using ${fallback.name} for the next ${PRIMARY_COOLDOWN_MS / 60000} min`);
      return viaFallback([
        ...err.failedAttempts,
        { model: err.model ?? primary.model, errorMessage: err.message, latencyMs: err.latencyMs ?? 0 },
      ]);
    }
  }
}
