import type { LetterExtraction } from "./letter";

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

export interface ActionItemDto {
  id: string;
  text: string;
  done: boolean;
}

export interface DeadlineDto {
  id: string;
  dueDate: string; // YYYY-MM-DD
  kind: string;
  sourceText: string;
  /** true if the date depends on an assumed delivery date */
  isEstimate: boolean;
  /** How a relative deadline was calculated, step by step (empty for explicit dates) */
  explanation: string[];
}

export interface LetterAnalysisDto {
  extraction: LetterExtraction;
  model: string;
  promptVersion: string;
  createdAt: string;
  actionItems: ActionItemDto[];
  deadlines: DeadlineDto[];
}

export interface DocumentDetailDto extends DocumentDto {
  analysis: LetterAnalysisDto | null;
}

/** Steps the background worker reports while processing a document. */
export const PROCESSING_STEPS = ["preprocessing", "extracting", "saving", "retrying"] as const;
export type ProcessingStep = (typeof PROCESSING_STEPS)[number];

export const PROCESSING_STEP_LABELS: Record<ProcessingStep, string> = {
  preprocessing: "Preparing the file",
  extracting: "Reading and analyzing the letter",
  saving: "Saving the results",
  retrying: "The AI service is busy, trying again shortly",
};

/** Payload of each Server-Sent Event sent to the browser. */
export interface ProgressEvent {
  status: DocumentStatus;
  step?: ProcessingStep;
  message?: string;
}

export interface HealthDto {
  status: "ok" | "degraded" | "down";
  database: "up" | "down";
  redis: "up" | "down";
  /** Number of background workers connected to the queue */
  workers: number;
}

export interface ApiErrorBody {
  error: { message: string; code?: string };
}
