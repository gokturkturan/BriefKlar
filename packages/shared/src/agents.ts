import { z } from "zod";

/**
 * Messages between the agents that process a letter. Agents never call each other: every
 * message goes through the orchestrator, which delivers it, stores it (AgentMessage table) and
 * enforces the limits of a run. Large data (the file, the analysis, the deadlines) stays in the
 * run's case file; a message only says what was asked or what changed.
 */

export const AGENT_NAMES = [
  "orchestrator",
  "intake",
  "extractor",
  "verifier",
  "deadline",
  "explainer",
  "replyWriter",
  "translator",
  "research",
  "chat",
  /** The person the letter belongs to: answers a question an agent asked (F3) */
  "user",
] as const;
export const AgentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentNameSchema>;

/** Parts of the case file an agent can write */
export const CASE_FIELDS = [
  "intake",
  "extraction",
  "verdict",
  "deadlines",
  "explanation",
  "replyDraft",
  "translation",
] as const;
export const CaseFieldSchema = z.enum(CASE_FIELDS);
export type CaseField = z.infer<typeof CaseFieldSchema>;

/** A concrete problem one agent found in another agent's output */
export const AgentIssueSchema = z.object({
  /** Path of the field, e.g. "amounts[0].value" or "deadlines" */
  field: z.string().min(1),
  /** What is wrong */
  problem: z.string().min(1),
  /** The sentence of the letter that shows it */
  evidence: z.string().max(300),
});
export type AgentIssue = z.infer<typeof AgentIssueSchema>;

export const AGENT_QUESTIONS = ["RECEIVED_DATE", "FEDERAL_STATE", "REPLY_NOTES", "OTHER"] as const;
export type AgentQuestion = (typeof AGENT_QUESTIONS)[number];

/** Questions the page can show as a card; the others are answered by agents */
export const USER_QUESTIONS = ["RECEIVED_DATE", "FEDERAL_STATE"] as const satisfies readonly AgentQuestion[];
export type UserQuestion = (typeof USER_QUESTIONS)[number];

export function isUserQuestion(value: unknown): value is UserQuestion {
  return typeof value === "string" && (USER_QUESTIONS as readonly string[]).includes(value);
}

/**
 * Questions the chat puts to the user in its own words: the reply writer's question for details
 * of a reply (the reasons of an objection, the monthly instalment), answered in the next message
 */
export const CHAT_QUESTIONS = ["REPLY_NOTES"] as const satisfies readonly AgentQuestion[];
export type ChatQuestion = (typeof CHAT_QUESTIONS)[number];

/** Agents the chat can hand work to with its delegate tool */
export const DELEGATE_AGENTS = ["replyWriter"] as const satisfies readonly AgentName[];
export type DelegateAgent = (typeof DELEGATE_AGENTS)[number];

/** What the chat shows while another agent works for it (ChatStreamEvent "agent") */
export const AGENT_PHASES = ["started", "done", "revising", "waitingForUser", "failed"] as const;
export type AgentPhase = (typeof AGENT_PHASES)[number];

export const AgentPayloadSchema = z.discriminatedUnion("kind", [
  /** The orchestrator gives an agent work */
  z.object({
    kind: z.literal("task"),
    instruction: z.string().min(1),
    notes: z.array(AgentIssueSchema).default([]),
  }),
  /** The agent finished; `wrote` names the parts of the case file it changed */
  z.object({
    kind: z.literal("result"),
    wrote: z.array(CaseFieldSchema),
    summary: z.string(),
  }),
  /** An agent asks for another agent's output to be corrected */
  z.object({
    kind: z.literal("revise"),
    target: CaseFieldSchema,
    issues: z.array(AgentIssueSchema).min(1),
  }),
  /** An agent needs information to go on, from another agent or from the user */
  z.object({
    kind: z.literal("question"),
    askUser: z.boolean(),
    question: z.enum(AGENT_QUESTIONS),
    text: z.string().min(1),
  }),
  /**
   * The user's answer to a question (from "user"); `value` is the date, the federal state or the
   * details of a reply, null when the user does not know it. The run goes on from the agent that asked.
   */
  z.object({
    kind: z.literal("answer"),
    question: z.enum(AGENT_QUESTIONS),
    value: z.string().nullable(),
  }),
  /** Work is passed on to another agent, e.g. from the chat to the reply writer */
  z.object({
    kind: z.literal("handoff"),
    reason: z.string().min(1),
    input: z.record(z.string(), z.unknown()),
  }),
  /** The agent failed */
  z.object({
    kind: z.literal("error"),
    code: z.string().min(1),
    message: z.string(),
    retryable: z.boolean(),
  }),
]);
export type AgentPayload = z.infer<typeof AgentPayloadSchema>;
export type AgentMessageKind = AgentPayload["kind"];

export const AgentMessageSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  /** The message this one answers; null for the first task of a run */
  parentId: z.uuid().nullable(),
  from: AgentNameSchema,
  to: AgentNameSchema,
  /** Position in the run, counted from 0; the orchestrator stops a run at MAX_AGENT_HOPS */
  hop: z.number().int().min(0),
  payload: AgentPayloadSchema,
  createdAt: z.iso.datetime(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

/** What started a run */
export const AGENT_RUN_TRIGGERS = ["UPLOAD", "CHAT", "REPLY"] as const;
export type AgentRunTrigger = (typeof AGENT_RUN_TRIGGERS)[number];

/**
 * WAITING_FOR_USER: an agent asked the user a question; the analysis is stored and shown, and the
 * run goes on from that agent once the user answers
 */
export const AGENT_RUN_STATUSES = ["RUNNING", "WAITING_FOR_USER", "DONE", "FAILED"] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

/**
 * Messages per run; stops loops between agents. The longest plan of an upload needs 17: intake,
 * extractor, verifier, correction, second check, deadline agent and translator, a task and a
 * reply each, and after a question to the user their answer and the deadline agent once more.
 * A reply from the chat needs at most 15: the handoff, the reply writer's question, the answer,
 * the draft, its check, a correction, the second check and the research agent.
 */
export const MAX_AGENT_HOPS = 17;

/** Questions to the user per run: one card at most, so a letter never turns into a form */
export const MAX_USER_QUESTIONS_PER_RUN = 1;

/** Model requests per run. Only free tiers are used for now, so the limit is a count, not money. */
export const MAX_LLM_CALLS_PER_RUN = 6;
