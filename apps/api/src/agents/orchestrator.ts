import { randomUUID } from "node:crypto";
import {
  MAX_AGENT_HOPS,
  MAX_LLM_CALLS_PER_RUN,
  MAX_USER_QUESTIONS_PER_RUN,
  USER_QUESTIONS,
  type AgentIssue,
  type AgentMessage,
  type AgentName,
  type AgentPayload,
  type AgentPhase,
  type AgentQuestion,
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
  /** Continues a stored run (after the user's answer) instead of starting at its first message */
  resume?: RunSoFar;
  /**
   * Questions this run can put to the user: an upload's page shows RECEIVED_DATE and
   * FEDERAL_STATE as a card, the chat asks REPLY_NOTES in its answer
   */
  askable?: readonly AgentQuestion[];
  /** Tells the caller when an agent starts and how it ended (the chat shows it while it waits) */
  onAgent?: (agent: AgentName, phase: AgentPhase) => void;
}

/** What a stored run did before it stopped to wait for the user, read from its AgentMessage rows */
export interface RunSoFar {
  /** Messages stored so far */
  hops: number;
  /** Agents that replied without an error; the plan does not give them the same task again */
  ran: AgentName[];
  /** Questions shown to the user so far */
  userQuestions: number;
}

/** A question an agent asked that the user is to answer */
export interface PendingQuestion {
  messageId: string;
  agent: AgentName;
  question: AgentQuestion;
  /** The agent's words, for the trace and for the chat, which asks in the user's language */
  text: string;
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
  private readonly ran = new Set<AgentName>();
  private userQuestions = 0;
  private waiting: PendingQuestion | null = null;
  private readonly askable: ReadonlySet<AgentQuestion>;

  constructor(
    readonly runId: string,
    readonly caseFile: C,
    private readonly options: OrchestratorOptions,
  ) {
    this.maxHops = options.maxHops ?? MAX_AGENT_HOPS;
    this.maxLlmCalls = options.maxLlmCalls ?? MAX_LLM_CALLS_PER_RUN;
    this.askable = new Set(options.askable ?? USER_QUESTIONS);
    if (options.resume) {
      this.hop = options.resume.hops;
      for (const agent of options.resume.ran) this.ran.add(agent);
      this.userQuestions = options.resume.userQuestions;
    }
  }

  /** true when the agent already replied in this run (also before a resume) */
  hasRun(agent: AgentName): boolean {
    return this.ran.has(agent);
  }

  /** The question the run waits for after the plan, if an agent asked the user one */
  get pendingQuestion(): PendingQuestion | null {
    return this.waiting;
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
    this.notify(agent.name, "started");

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
      this.notify(agent.name, "failed");
      await this.record(agent.name, "orchestrator", errorPayload(err), taskMessage.id).catch((recordErr: unknown) =>
        console.error(`Could not store the error of ${agent.name}:`, recordErr),
      );
      throw err;
    }

    this.lastReply = (await this.record(agent.name, "orchestrator", reply, taskMessage.id)).id;
    this.ran.add(agent.name);

    // The orchestrator decides what reaches the user: one card per run, and only questions the
    // page can show. Any other question stays in the trace and the plan goes on without it.
    if (reply.kind === "question" && reply.askUser) {
      if (this.askable.has(reply.question) && !this.waiting && this.userQuestions < MAX_USER_QUESTIONS_PER_RUN) {
        this.waiting = { messageId: this.lastReply, agent: agent.name, question: reply.question, text: reply.text };
        this.userQuestions += 1;
      } else {
        console.warn(`Run ${this.runId}: not asking the user ${reply.question} (one question per run)`);
      }
    }
    this.notify(
      agent.name,
      reply.kind === "revise" ? "revising" : this.waiting?.messageId === this.lastReply ? "waitingForUser" : "done",
    );
    return reply;
  }

  /**
   * Stores that `from` passes work on to `to` (the chat to the reply writer), with what it was
   * given; the plan then gives `to` its task, answering this message. Returns the message id.
   */
  async handoff(from: AgentName, to: AgentName, reason: string, input: Record<string, unknown>): Promise<string> {
    if (this.hop + 1 > this.maxHops) {
      throw new AgentLimitError(`Run ${this.runId} would exceed ${this.maxHops} messages`, "hops");
    }
    const message = await this.record(from, to, { kind: "handoff", reason, input }, null);
    this.lastReply = message.id;
    return message.id;
  }

  /**
   * Stores the user's answer to the question the run waited for; the plan then gives the agent
   * that asked its task again, answering this message.
   */
  async recordAnswer(questionMessageId: string, question: AgentQuestion, value: string | null): Promise<void> {
    if (this.hop + 1 > this.maxHops) {
      throw new AgentLimitError(`Run ${this.runId} would exceed ${this.maxHops} messages`, "hops");
    }
    const message = await this.record("user", "orchestrator", { kind: "answer", question, value }, questionMessageId);
    this.lastReply = message.id;
  }

  /**
   * Ends the plan: the run waits for the user when an agent asked a question, else it is done.
   * Returns the question the page is to show.
   */
  async finish(): Promise<AgentQuestion | null> {
    if (this.waiting) {
      await this.options.store.waitForUser(this.runId);
      return this.waiting.question;
    }
    await this.options.store.finishRun(this.runId, "DONE");
    return null;
  }

  private notify(agent: AgentName, phase: AgentPhase): void {
    try {
      this.options.onAgent?.(agent, phase);
    } catch (err) {
      // What the chat shows must never stop the run
      console.error(`Could not report ${agent} ${phase}:`, err);
    }
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
