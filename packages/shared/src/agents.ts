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

export const AGENT_RUN_STATUSES = ["RUNNING", "DONE", "FAILED"] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

/**
 * Messages per run; stops loops between agents. The longest plan of an upload needs 14: intake,
 * extractor, verifier, correction, second check, deadline agent and translator, a task and a
 * reply each.
 */
export const MAX_AGENT_HOPS = 14;

/** Model requests per run. Only free tiers are used for now, so the limit is a count, not money. */
export const MAX_LLM_CALLS_PER_RUN = 6;
