/**
 * Normalized error for all LLM providers.
 * - retryable: temporary problems (overloaded, rate limited, network) -> retry later
 * - not retryable: our fault or configuration (invalid key, unknown model, bad request) -> fail fast
 */
export class LLMError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    /** Safe to show to end users */
    readonly userMessage: string,
    readonly statusCode?: number,
    /** The model that failed */
    readonly model?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function userMessageForStatus(status: number | undefined): string {
  switch (status) {
    case 429:
      return "The AI service rate limit was reached. Please try again in a few minutes.";
    case 503:
    case 500:
    case 502:
    case 504:
      return "The AI service is temporarily overloaded. Please try again in a few minutes.";
    case 401:
    case 403:
      return "The AI service rejected the API key. Check GEMINI_API_KEY.";
    case 404:
      return "The configured AI model was not found. Check GEMINI_MODEL.";
    default:
      return "The AI service could not process this letter.";
  }
}

export function isRetryableStatus(status: number | undefined): boolean {
  // No status usually means a network error, which is worth retrying
  return status === undefined || RETRYABLE_STATUS.has(status);
}
