import type { AgentName, UserQuestion } from "./agents";
import type { DeadlineStep } from "./deadlineSteps";
import type { ErrorCode } from "./errors";
import type { ScanQuality } from "./intake";
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
  /** Why processing failed, for a message in the reader's language */
  errorCode: ErrorCode | null;
  /** Day the letter arrived (YYYY-MM-DD), entered by the user */
  receivedDate: string | null;
  /** How readable the upload is, as the intake agent saw it; null before it ran */
  scanQuality: ScanQuality | null;
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
  steps: DeadlineStep[];
}

export interface LetterAnalysisDto {
  extraction: LetterExtraction;
  model: string;
  promptVersion: string;
  /**
   * true when the intake agent found no official letter and the full analysis was left out;
   * the analysis then only says what the document is
   */
  screenedOut: boolean;
  createdAt: string;
  actionItems: ActionItemDto[];
  deadlines: DeadlineDto[];
}

/** A question an agent asked about this letter that the user has not answered yet */
export interface PendingQuestionDto {
  question: UserQuestion;
  /** Due dates that are estimated until the question is answered */
  estimatedDeadlines: number;
}

export interface DocumentDetailDto extends DocumentDto {
  analysis: LetterAnalysisDto | null;
  /** At most one per run; null when nothing is asked */
  question: PendingQuestionDto | null;
}

/** Steps the background worker reports while processing a document. */
export const PROCESSING_STEPS = [
  "classifying",
  "preprocessing",
  "extracting",
  "verifying",
  "translating",
  "saving",
  "retrying",
] as const;
export type ProcessingStep = (typeof PROCESSING_STEPS)[number];

/** Payload of each Server-Sent Event sent to the browser. */
export interface ProgressEvent {
  status: DocumentStatus;
  step?: ProcessingStep;
  /** The agent working on this step (shown in the developer overview, not to users) */
  agent?: AgentName;
  message?: string;
  code?: ErrorCode;
  /**
   * waitingForUser: the analysis is stored (status DONE), but an agent asked the user a question;
   * the page shows it as a card, and the run goes on once it is answered
   */
  phase?: "waitingForUser";
  question?: UserQuestion;
}

export interface HealthDto {
  status: "ok" | "degraded" | "down";
  database: "up" | "down";
  redis: "up" | "down";
  /** Number of background workers connected to the queue */
  workers: number;
}

export interface ApiErrorBody {
  error: { message: string; code: ErrorCode };
}
