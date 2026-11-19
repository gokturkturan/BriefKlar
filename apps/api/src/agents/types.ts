import type { AgentName, AgentPayload, ProcessingStep } from "@briefklar/shared";

/** The task the orchestrator gives an agent */
export type AgentTask = Extract<AgentPayload, { kind: "task" }>;

/** What an agent may answer with; a failure is thrown, and the orchestrator records it */
export type AgentReply = Extract<AgentPayload, { kind: "result" | "revise" | "question" }>;

export interface AgentContext<C> {
  runId: string;
  /** The shared state of the run: agents read their input from it and write their output to it */
  caseFile: C;
  /** Reports a processing step to the browser (job progress) */
  report: (step: ProcessingStep) => Promise<void>;
}

/**
 * One agent. It reads from the case file, writes its output to the case file and answers the
 * orchestrator. It never calls another agent: a correction or a question goes back as its reply.
 */
export interface Agent<C> {
  readonly name: AgentName;
  handle(task: AgentTask, context: AgentContext<C>): Promise<AgentReply>;
}
