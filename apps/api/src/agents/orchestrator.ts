import { randomUUID } from "node:crypto";
import {
  MAX_AGENT_HOPS,
  MAX_LLM_CALLS_PER_RUN,
  type AgentIssue,
  type AgentMessage,
  type AgentName,
  type AgentPayload,
  type ProgressEvent,
} from "@briefklar/shared";
import { LLMError } from "../llm/errors";
import { runInAgentScope } from "./agentScope";
import type { AgentStore } from "./agentStore";
import type { Agent, AgentReply, AgentTask } from "./types";

/** A run reached MAX_AGENT_HOPS or MAX_LLM_CALLS_PER_RUN; trying again would not help */
export class AgentLimitError extends Error {
  constructor(
    message: string,
    readonly limit: "hops" | "llmCalls",
  ) {
    super(message);
    this.name = "AgentLimitError";
  }
}

export interface OrchestratorOptions {
  store: AgentStore;
  /** Passes job progress on to the browser */
  onProgress: (event: ProgressEvent) => Promise<void>;
  maxHops?: number;
  maxLlmCalls?: number;
}

/**
 * Delivers the messages of one run. Agents never call each other: the orchestrator gives an agent
 * a task, stores the task and the reply as AgentMessage rows, and keeps the run inside its limits
 * (messages and model requests). Every model request an agent makes is logged with the run and
 * the agent (agentScope.ts).
 */
export class Orchestrator<C> {
  private hop = 0;
  private lastReply: string | null = null;
  private readonly maxHops: number;
  private readonly maxLlmCalls: number;

  constructor(
    readonly runId: string,
    readonly caseFile: C,
    private readonly options: OrchestratorOptions,
  ) {
    this.maxHops = options.maxHops ?? MAX_AGENT_HOPS;
    this.maxLlmCalls = options.maxLlmCalls ?? MAX_LLM_CALLS_PER_RUN;
  }

  /** Messages stored in this run so far */
  get hops(): number {
    return this.hop;
  }

  /** Id of the latest reply, so a follow-up task (e.g. a correction) can answer it */
  get lastReplyId(): string | null {
    return this.lastReply;
  }

  /** Model requests the run may still make */
  async llmCallsLeft(): Promise<number> {
    return Math.max(0, this.maxLlmCalls - (await this.options.store.llmCallCount(this.runId)));
  }

  /**
   * Gives `agent` a task and returns its reply. A failure of the agent is stored as an error
   * message and thrown on unchanged, so the caller (the BullMQ job) decides about retries.
   */
  async dispatch(
    agent: Agent<C>,
    instruction: string,
    options: { notes?: AgentIssue[]; parentId?: string } = {},
  ): Promise<AgentReply> {
    // Two messages per dispatch: the task and the reply (or the error)
    if (this.hop + 2 > this.maxHops) {
      throw new AgentLimitError(`Run ${this.runId} would exceed ${this.maxHops} messages`, "hops");
    }
    if (agent.usesModel !== false) {
      const calls = await this.options.store.llmCallCount(this.runId);
      if (calls >= this.maxLlmCalls) {
        throw new AgentLimitError(`Run ${this.runId} already made ${calls} model requests`, "llmCalls");
      }
    }

    const task: AgentTask = { kind: "task", instruction, notes: options.notes ?? [] };
    const taskMessage = await this.record("orchestrator", agent.name, task, options.parentId ?? null);

    let reply: AgentReply;
    try {
      reply = await runInAgentScope({ runId: this.runId, agent: agent.name }, () =>
        agent.handle(task, {
          runId: this.runId,
          caseFile: this.caseFile,
          report: (step) => this.options.onProgress({ status: "PROCESSING", step, agent: agent.name }),
        }),
      );
    } catch (err) {
      await this.record(agent.name, "orchestrator", errorPayload(err), taskMessage.id).catch((recordErr: unknown) =>
        console.error(`Could not store the error of ${agent.name}:`, recordErr),
      );
      throw err;
    }

    this.lastReply = (await this.record(agent.name, "orchestrator", reply, taskMessage.id)).id;
    return reply;
  }

  private async record(
    from: AgentName,
    to: AgentName,
    payload: AgentPayload,
    parentId: string | null,
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: randomUUID(),
      runId: this.runId,
      parentId,
      from,
      to,
      hop: this.hop,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.hop += 1;
    await this.options.store.recordMessage(message);
    return message;
  }
}

function errorPayload(err: unknown): Extract<AgentPayload, { kind: "error" }> {
  if (err instanceof LLMError) {
    return { kind: "error", code: err.code, message: err.message.slice(0, 500), retryable: err.retryable };
  }
  return {
    kind: "error",
    code: err instanceof AgentLimitError ? "AGENT_LIMIT" : "AGENT_FAILED",
    message: (err instanceof Error ? err.message : String(err)).slice(0, 500),
    retryable: !(err instanceof AgentLimitError),
  };
}
