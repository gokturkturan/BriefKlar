import { z } from "zod";
import type { AgentName, AgentPhase } from "./agents";
import type { ErrorCode } from "./errors";
import type { ReplyType } from "./reply";

/**
 * Chat about one letter. The model answers with the help of tools that run in the API:
 * the knowledge base, the deadline engine, the holiday calendar, the letter's analysis and
 * reminders. The web app shows which tools were used and the sources the answer is based on.
 */

export const CHAT_TOOL_NAMES = [
  "get_letter_details",
  "search_knowledge_base",
  "calculate_deadline",
  "check_date",
  "list_public_holidays",
  "list_reminders",
  "create_reminder",
  /** Hands work to another agent through the orchestrator (a reply draft to the reply writer) */
  "delegate",
] as const;
export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];

export function isChatToolName(value: unknown): value is ChatToolName {
  return typeof value === "string" && (CHAT_TOOL_NAMES as readonly string[]).includes(value);
}

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export interface ChatToolCallDto {
  name: ChatToolName;
  /** false if the tool returned an error (bad arguments, date in the past, ...) */
  ok: boolean;
}

/** A knowledge base entry the answer used */
export interface ChatSourceDto {
  title: string;
  url: string;
}

/** A reply draft the chat had written; the page links to it in the reply section */
export interface ChatReplyDraftDto {
  id: string;
  type: ReplyType;
}

export interface ChatMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ChatToolCallDto[];
  sources: ChatSourceDto[];
  /** The draft this answer delivered; null when it delivered none or the draft was deleted */
  replyDraft: ChatReplyDraftDto | null;
  /** The model that wrote an assistant message */
  model: string | null;
  createdAt: string;
}

export const SendChatMessageSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});
export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;

/** Payload of each Server-Sent Event while the assistant answers */
export type ChatStreamEvent =
  | { type: "tool"; name: ChatToolName; status: "running" | "done" | "failed" }
  /** Another agent works for the chat (reply writer, verifier, research), without the details of the trace */
  | { type: "agent"; agent: AgentName; phase: AgentPhase }
  | { type: "delta"; text: string }
  | { type: "done"; userMessage: ChatMessageDto; message: ChatMessageDto }
  | { type: "error"; message: string; code: ErrorCode };
