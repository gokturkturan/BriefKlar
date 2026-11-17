/**
 * Types shared between the API and the web app.
 * Changing a field here surfaces type errors on both sides immediately.
 */

export const DOCUMENT_STATUSES = ["UPLOADED", "PROCESSING", "DONE", "FAILED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const TERMINAL_STATUSES: readonly DocumentStatus[] = ["DONE", "FAILED"];

export function isTerminalStatus(status: DocumentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024, // 10 MB
  acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
} as const;

export type AcceptedMimeType = (typeof UPLOAD_LIMITS.acceptedMimeTypes)[number];

export interface DocumentDto {
  id: string;
  originalName: string;
  mimeType: AcceptedMimeType;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string; // ISO date
}

/** Steps the background worker reports while processing a document. */
export const PROCESSING_STEPS = ["preprocessing", "extracting", "analyzing", "retrying"] as const;
export type ProcessingStep = (typeof PROCESSING_STEPS)[number];

export const PROCESSING_STEP_LABELS: Record<ProcessingStep, string> = {
  preprocessing: "Preparing the file",
  extracting: "Reading the letter",
  analyzing: "Analyzing the content",
  retrying: "Something went wrong, retrying",
};

/** Payload of each Server-Sent Event sent to the browser. */
export interface ProgressEvent {
  status: DocumentStatus;
  step?: ProcessingStep;
  message?: string;
}

export interface ApiErrorBody {
  error: { message: string; code?: string };
}
