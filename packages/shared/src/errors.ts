/**
 * Error codes the API sends with every error. The web app shows a message in the reader's
 * language for each code; the English message in the response is only a fallback for logs
 * and other clients.
 */
export const ERROR_CODES = [
  // Requests
  "NOT_FOUND",
  "NOT_AUTHENTICATED",
  "INVALID_BODY",
  "INVALID_PARAM",
  "INVALID_LANGUAGE",
  "INTERNAL",
  // Accounts
  "INVALID_CREDENTIALS",
  "EMAIL_TAKEN",
  "TOO_MANY_ATTEMPTS",
  // Uploads
  "NO_FILE",
  "UNSUPPORTED_TYPE",
  "LIMIT_FILE_SIZE",
  // Letters
  "DOCUMENT_NOT_FOUND",
  "ACTION_ITEM_NOT_FOUND",
  "DRAFT_NOT_FOUND",
  "ALREADY_PROCESSING",
  "NOT_ANALYZED",
  "INVALID_DATE",
  "DATE_IN_FUTURE",
  "DATE_BEFORE_LETTER",
  // Reminders
  "REMINDER_NOT_FOUND",
  "DATE_IN_PAST",
  // AI service
  "AI_RATE_LIMITED",
  "AI_OVERLOADED",
  "AI_KEY_REJECTED",
  "AI_MODEL_NOT_FOUND",
  "AI_FAILED",
  "AI_INCOMPLETE",
  "PROCESSING_FAILED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
