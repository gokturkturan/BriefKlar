import {
  AgentPayloadSchema,
  isExplanationLanguage,
  isUserQuestion,
  type AgentName,
  type ErrorCode,
  type UserQuestion,
} from "@briefklar/shared";
import { latestExtraction, letterOf } from "../documents/extractions";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm/errors";
import { analyseLetter, LETTER_AGENTS, type LetterAgents } from "./analyseLetter";
import { prismaAgentStore, type AgentStore } from "./agentStore";
import type { DocumentCaseFile } from "./documentCaseFile";
import { Orchestrator, type PendingQuestion, type RunSoFar } from "./orchestrator";

/** A run that stopped at a question to the user, as its messages tell */
export interface WaitingRun extends PendingQuestion, RunSoFar {
  runId: string;
}

/** The columns of an AgentMessage row the resume needs */
export interface StoredMessage {
  id: string;
  from: string;
  hop: number;
  payload: unknown;
}

const NOT_AGENTS: ReadonlySet<AgentName> = new Set<AgentName>(["orchestrator", "user"]);

/**
 * Reads where a run stopped from its messages: the last question to the user, the agents that
 * replied without an error before it (the plan does not run them again) and the message count.
 * The agent that asked is left out of `ran`: it gets its task again with the answer.
 */
export function readWaitingRun(
  runId: string,
  hops: number,
  messages: StoredMessage[],
): WaitingRun | null {
  const ordered = [...messages].sort((a, b) => a.hop - b.hop);
  const ran = new Set<AgentName>();
  let question: PendingQuestion | null = null;
  let userQuestions = 0;

  for (const message of ordered) {
    const payload = AgentPayloadSchema.safeParse(message.payload);
    if (!payload.success) continue;
    const from = message.from as AgentName;
    if (NOT_AGENTS.has(from) || payload.data.kind === "task" || payload.data.kind === "error") continue;
    ran.add(from);
    if (payload.data.kind === "question" && payload.data.askUser && isUserQuestion(payload.data.question)) {
      question = { messageId: message.id, agent: from, question: payload.data.question };
      userQuestions += 1;
    }
  }
  if (!question) return null;
  ran.delete(question.agent);
  return { runId, ...question, hops, ran: [...ran], userQuestions };
}

/** The latest run of the document, if it waits for the user's answer */
export async function waitingRun(documentId: string): Promise<WaitingRun | null> {
  const run = await prisma.agentRun.findFirst({
    where: { documentId },
    orderBy: { startedAt: "desc" },
    include: { messages: { select: { id: true, from: true, payload: true, hop: true } } },
  });
  if (!run || run.status !== "WAITING_FOR_USER") return null;
  return readWaitingRun(run.id, run.hops, run.messages);
}

/**
 * Goes on with a run that waits for the user, once their answer is stored (the delivery date on
 * the Document, the state on the User). The answer becomes a message of the run, and the plan
 * starts again at the agent that asked; the extraction and its verification are not repeated.
 * Returns false when the document has no run waiting for this question.
 */
export async function resumeLetterRun(
  documentId: string,
  answer: { question: UserQuestion; value: string | null },
  { store = prismaAgentStore, agents = LETTER_AGENTS }: { store?: AgentStore; agents?: LetterAgents } = {},
): Promise<boolean> {
  const waiting = await waitingRun(documentId);
  if (!waiting || waiting.question !== answer.question) return false;
  // A second answer (two tabs, a double click) finds the run running or done
  if (!(await store.resumeRun(waiting.runId))) return false;

  try {
    const [doc, saved] = await Promise.all([
      prisma.document.findUniqueOrThrow({
        where: { id: documentId },
        include: { user: { select: { preferredLanguage: true } } },
      }),
      latestExtraction(documentId),
    ]);
    const caseFile: DocumentCaseFile = {
      documentId,
      fileKey: doc.fileKey,
      mimeType: doc.mimeType,
      language: isExplanationLanguage(doc.user.preferredLanguage) ? doc.user.preferredLanguage : null,
      savedExtraction: saved ?? undefined,
      extraction: letterOf(saved) ?? undefined,
      answer,
    };
    const orchestrator = new Orchestrator(waiting.runId, caseFile, {
      store,
      onProgress: async () => {},
      resume: waiting,
    });

    await orchestrator.recordAnswer(waiting.messageId, answer.question, answer.value);
    await analyseLetter(orchestrator, agents);
    await orchestrator.finish();
    return true;
  } catch (err) {
    const code: ErrorCode = err instanceof LLMError ? err.code : "PROCESSING_FAILED";
    await store.finishRun(waiting.runId, "FAILED", code).catch((finishErr: unknown) =>
      console.error(`Could not close agent run ${waiting.runId}:`, finishErr),
    );
    throw err;
  }
}
