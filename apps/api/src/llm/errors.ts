import type { ErrorCode } from "@briefklar/shared";

/**
 * Normalized error for all LLM providers.
 * - retryable: temporary problems (overloaded, rate limited, network) -> retry later
 * - not retryable: our fault or configuration (invalid key, unknown model, bad request) -> fail fast
 */
export class LLMError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    /** Safe to show to end users (English; the web app translates the code) */
    readonly userMessage: string,
    readonly code: ErrorCode,
    readonly statusCode?: number,
    /** The model that failed */
    readonly model?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function userErrorForStatus(status: number | undefined): { message: string; code: ErrorCode } {
  switch (status) {
    case 429:
      return {
        code: "AI_RATE_LIMITED",
        message: "The AI service rate limit was reached. Please try again in a few minutes.",
      };
    case 503:
    case 500:
    case 502:
    case 504:
      return {
        code: "AI_OVERLOADED",
        message: "The AI service is temporarily overloaded. Please try again in a few minutes.",
      };
    case 401:
    case 403:
      return { code: "AI_KEY_REJECTED", message: "The AI service rejected the API key. Check GEMINI_API_KEY." };
    case 404:
      return { code: "AI_MODEL_NOT_FOUND", message: "The configured AI model was not found. Check GEMINI_MODEL." };
    default:
      return { code: "AI_FAILED", message: "The AI service could not process this letter." };
  }
}

export function isRetryableStatus(status: number | undefined): boolean {
  // No status usually means a network error, which is worth retrying
  return status === undefined || RETRYABLE_STATUS.has(status);
}
