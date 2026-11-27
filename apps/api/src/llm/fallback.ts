import { LLMError } from "./errors";

/** A model that was tried and failed before another model answered (or everything failed) */
export interface FailedAttempt {
  model: string;
  errorMessage: string;
  latencyMs: number;
}

export interface FallbackResult<T> {
  value: T;
  /** The model that produced `value` */
  model: string;
  /** How long the answering model took (without the failed attempts before it) */
  latencyMs: number;
  /** The primary model, if it failed and the fallback model answered instead */
  failedAttempts: FailedAttempt[];
}

/** After the primary model is overloaded, skip it for a while instead of waiting for it to fail again */
export const PRIMARY_COOLDOWN_MS = 2 * 60 * 1000;

/** Overload (503) and quota (429) are per model, so a smaller model often still works. */
const OVERLOADED_STATUS = new Set([429, 503, 504]);

/**
 * Simple circuit breaker around a primary and an optional fallback model: after the primary
 * is overloaded or rate limited, the fallback answers for a while instead of waiting for the
 * primary to fail again.
 *
 * Every failed attempt is returned (or attached to the thrown error), so the caller can log
 * a switch to the fallback model as its own call instead of only the model that answered.
 */
export class FallbackRunner {
  private primaryCooldownUntil = 0;

  constructor(
    readonly primary: string,
    readonly fallback: string | undefined,
    private readonly toError: (err: unknown, model: string) => LLMError,
    private readonly now: () => number = Date.now,
  ) {}

  async run<T>(
    call: (model: string) => Promise<T>,
    /** false once output reached the user, so an answer is never mixed from two models */
    canFallBack: () => boolean = () => true,
  ): Promise<FallbackResult<T>> {
    const failedAttempts: FailedAttempt[] = [];

    const attempt = async (model: string): Promise<FallbackResult<T>> => {
      const startedAt = this.now();
      try {
        const value = await call(model);
        return { value, model, latencyMs: this.now() - startedAt, failedAttempts };
      } catch (err) {
        const error = this.toError(err, model);
        error.failedAttempts = [...failedAttempts];
        error.latencyMs = this.now() - startedAt;
        throw error;
      }
    };

    if (this.fallback && this.now() < this.primaryCooldownUntil) return attempt(this.fallback);

    try {
      return await attempt(this.primary);
    } catch (err) {
      const error = err as LLMError;
      // A timeout (504) usually means the same overload, without an error from the API
      const overloaded = OVERLOADED_STATUS.has(error.statusCode ?? 0);
      if (!this.fallback || !overloaded || !canFallBack()) throw error;

      this.primaryCooldownUntil = this.now() + PRIMARY_COOLDOWN_MS;
      console.warn(`${error.message} -> using ${this.fallback} for the next ${PRIMARY_COOLDOWN_MS / 60000} min`);
      failedAttempts.push({ model: this.primary, errorMessage: error.message, latencyMs: error.latencyMs ?? 0 });
      return attempt(this.fallback);
    }
  }
}
