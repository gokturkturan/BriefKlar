import type { ReplyDraft } from "@prisma/client";
import {
  AgentPayloadSchema,
  CHAT_QUESTIONS,
  type AgentIssue,
  type AgentName,
  type AgentPhase,
  type ChatSourceDto,
  type ErrorCode,
  type ExplanationLanguage,
  type ReplyType,
} from "@briefklar/shared";
import { todayInGermany } from "../deadlines/calendarDate";
import { requireExtraction } from "../documents/extractions";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm/errors";
import { LLMValidationError } from "../llm/generateStructured";
import { composeReplyLetter } from "../replies/composeReplyLetter";
import { REPLY_DRAFT_PROMPT_VERSION } from "../replies/draftReply";
import { replySources, withoutUnsupportedFacts } from "../replies/replyFacts";
import type { ReplyNoteTopic } from "../replies/replyNotes";
import { MAX_REVISIONS, optional } from "./analyseLetter";
import { prismaAgentStore, type AgentStore } from "./agentStore";
import { Orchestrator } from "./orchestrator";
import type { ReplyCaseFile } from "./replyCaseFile";
import { replyVerifierAgent } from "./replyVerifierAgent";
import { replyWriterAgent } from "./replyWriterAgent";
import { researchAgent } from "./researchAgent";
import { readWaitingRun, type StoredMessage, type WaitingRun } from "./resumeRun";
import type { Agent } from "./types";

export interface ReplyAgents {
  replyWriter: Agent<ReplyCaseFile>;
  verifier: Agent<ReplyCaseFile>;
  research: Agent<ReplyCaseFile>;
}

export const REPLY_AGENTS: ReplyAgents = {
  replyWriter: replyWriterAgent,
  verifier: replyVerifierAgent,
  research: researchAgent,
};

/**
 * The plan for a reply draft. The reply writer may first ask the user for details only they know
 * (in the chat, once per run): the run then stops and waits. Otherwise it writes the draft, the
 * verifier checks it for facts that neither the letter's analysis nor the user's notes contain,
 * and the writer corrects it once. Numbers no source backs after that become placeholders (code,
 * no model). Then the research agent finds official sources about this kind of reply, for the
 * chat to show next to the draft. Returns "question" when the run waits for the user.
 */
export async function writeReply(
  orchestrator: Orchestrator<ReplyCaseFile>,
  agents: ReplyAgents = REPLY_AGENTS,
  { research = true }: { research?: boolean } = {},
): Promise<"question" | "draft"> {
  const { caseFile } = orchestrator;
  const parentId = () => orchestrator.lastReplyId ?? undefined;

  const first = await orchestrator.dispatch(
    agents.replyWriter,
    caseFile.mayAsk ? "Write the reply, or ask the user for what only they know" : "Write the reply",
    { parentId: parentId() },
  );
  if (first.kind === "question") {
    if (orchestrator.pendingQuestion) return "question";
    // The orchestrator did not put the question to the user: write with placeholders instead
    caseFile.mayAsk = false;
    await orchestrator.dispatch(agents.replyWriter, "Write the reply with placeholders for what is missing", {
      parentId: parentId(),
    });
  }

  // A correction needs two requests (the draft and its check); the research agent one more
  const reserve = research ? 1 : 0;
  let verdict = await optional(
    orchestrator,
    agents.verifier,
    "Check the draft for facts that are not in the letter or the notes",
    { parentId: parentId() },
  );
  for (let round = 0; round < MAX_REVISIONS && verdict?.kind === "revise"; round++) {
    if ((await orchestrator.llmCallsLeft()) < 2 + reserve) break;
    try {
      await orchestrator.dispatch(agents.replyWriter, "Correct the draft", {
        notes: verdict.issues,
        parentId: parentId(),
      });
    } catch (err) {
      // The first draft is still usable; its unsupported numbers become placeholders below
      if (!(err instanceof LLMError) && !(err instanceof LLMValidationError)) throw err;
      console.warn(`Run ${orchestrator.runId}: correction failed, keeping the first draft:`, err.message);
      break;
    }
    verdict = await optional(orchestrator, agents.verifier, "Check the corrected draft", { parentId: parentId() });
  }

  if (!caseFile.body) throw new Error("The reply writer wrote no draft");
  const { body, replaced } = withoutUnsupportedFacts(caseFile.body, replySources(caseFile));
  caseFile.body = body;
  caseFile.replaced = replaced;

  if (research)
    await optional(orchestrator, agents.research, `Find official sources about ${caseFile.type}`, {
      parentId: parentId(),
    });
  return "draft";
}

/** A chat run that waits for the details of a reply, and what it was asked to write */
export interface WaitingReplyRun extends WaitingRun<"REPLY_NOTES"> {
  type: ReplyType | null;
  /** The notes of the handoff, before the question */
  notes: string;
}

/** Reads the waiting chat run from its messages: the question, and the reply type and notes of its handoff */
export function readWaitingReplyRun(runId: string, hops: number, messages: StoredMessage[]): WaitingReplyRun | null {
  const waiting = readWaitingRun(runId, hops, messages, CHAT_QUESTIONS);
  if (!waiting) return null;
  let type: ReplyType | null = null;
  let notes = "";
  for (const message of messages) {
    const payload = AgentPayloadSchema.safeParse(message.payload);
    if (payload.success && payload.data.kind === "handoff" && typeof payload.data.input.type === "string") {
      type = payload.data.input.type as ReplyType;
      notes = typeof payload.data.input.notes === "string" ? payload.data.input.notes : "";
    }
  }
  return { ...waiting, type, notes };
}

/** The document's latest chat run, if it waits for the details of a reply */
export async function waitingReplyRun(documentId: string): Promise<WaitingReplyRun | null> {
  const run = await prisma.agentRun.findFirst({
    where: { documentId, trigger: "CHAT" },
    orderBy: { startedAt: "desc" },
    include: { messages: { select: { id: true, from: true, payload: true, hop: true } } },
  });
  if (!run || run.status !== "WAITING_FOR_USER") return null;
  return readWaitingReplyRun(run.id, run.hops, run.messages);
}

/** Closes the chat's waiting reply run, e.g. when the conversation is deleted */
export async function dropWaitingReplyRuns(documentId: string): Promise<void> {
  await prisma.agentRun.updateMany({
    where: { documentId, trigger: "CHAT", status: "WAITING_FOR_USER" },
    data: { status: "DONE", errorCode: "SUPERSEDED", finishedAt: new Date() },
  });
}

export interface ReplyRequest {
  documentId: string;
  type: ReplyType;
  notes: string;
  language: ExplanationLanguage;
  /** CHAT: the chat handed the work over and may ask the user; REPLY: the reply panel */
  trigger: "CHAT" | "REPLY";
  /** Why the chat handed the work over (stored with the handoff) */
  reason?: string;
  onAgent?: (agent: AgentName, phase: AgentPhase) => void;
}

export type ReplyOutcome =
  | { status: "question"; runId: string; missing: ReplyNoteTopic[]; text: string }
  | {
      status: "draft";
      runId: string;
      draft: ReplyDraft;
      sources: ChatSourceDto[];
      /** Issues the last check still found (the numbers among them were replaced) */
      issues: AgentIssue[];
      /** Numbers that became placeholders */
      replaced: string[];
    };

/**
 * Writes a reply draft as an agent run and stores it in ReplyDraft. From the chat, the run starts
 * with a handoff from the chat to the reply writer; when a chat run already waits for the details
 * of the same kind of reply, the user's words are its answer and that run goes on.
 */
export async function runReply(
  request: ReplyRequest,
  { store = prismaAgentStore, agents = REPLY_AGENTS }: { store?: AgentStore; agents?: ReplyAgents } = {},
): Promise<ReplyOutcome> {
  const { documentId, type, notes, language, trigger } = request;
  const chat = trigger === "CHAT";
  const caseFile: ReplyCaseFile = {
    documentId,
    type,
    notes,
    language,
    extraction: await requireExtraction(documentId),
    today: todayInGermany(),
    mayAsk: chat,
  };
  const options = { store, onProgress: async () => {}, askable: chat ? CHAT_QUESTIONS : [], onAgent: request.onAgent };

  const waiting = chat ? await waitingReplyRun(documentId) : null;
  let orchestrator: Orchestrator<ReplyCaseFile>;
  if (waiting && waiting.type === type && (await store.resumeRun(waiting.runId))) {
    caseFile.mayAsk = false;
    // The writer gets what the user said before the question and their answer
    if (waiting.notes && !notes.includes(waiting.notes))
      caseFile.notes = [waiting.notes, notes].filter(Boolean).join("\n");
    orchestrator = new Orchestrator(waiting.runId, caseFile, { ...options, resume: waiting });
    await orchestrator.recordAnswer(waiting.messageId, "REPLY_NOTES", notes || null);
  } else {
    // Starting a run closes a chat run that still waits (another kind of reply was asked for)
    const run = await store.startRun(documentId, trigger);
    orchestrator = new Orchestrator(run.id, caseFile, options);
    if (chat) {
      await orchestrator.handoff("chat", "replyWriter", request.reason ?? `The user asked for a ${type} draft`, {
        type,
        notes,
        language,
      });
    }
  }

  try {
    if ((await writeReply(orchestrator, agents, { research: chat })) === "question") {
      await orchestrator.finish();
      const question = orchestrator.pendingQuestion!;
      return { status: "question", runId: orchestrator.runId, missing: caseFile.missing ?? [], text: question.text };
    }

    const body = caseFile.body!;
    const draft = await prisma.replyDraft.create({
      data: {
        documentId,
        type,
        contentDe: composeReplyLetter({ type, extraction: caseFile.extraction, body, date: caseFile.today }),
        contentUserLanguage: body.translation.trim(),
        language,
        notes,
        model: caseFile.model,
        promptVersion: REPLY_DRAFT_PROMPT_VERSION,
      },
    });
    await orchestrator.finish();
    return {
      status: "draft",
      runId: orchestrator.runId,
      draft,
      sources: caseFile.sources ?? [],
      issues: caseFile.verdict?.issues ?? [],
      replaced: caseFile.replaced ?? [],
    };
  } catch (err) {
    const code: ErrorCode = err instanceof LLMError ? err.code : "AI_FAILED";
    await store
      .finishRun(orchestrator.runId, "FAILED", code)
      .catch((finishErr: unknown) => console.error(`Could not close agent run ${orchestrator.runId}:`, finishErr));
    throw err;
  }
}
