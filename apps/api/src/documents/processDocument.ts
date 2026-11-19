import { UnrecoverableError, type Job } from "bullmq";
import { isExplanationLanguage, type ErrorCode, type ProgressEvent } from "@briefklar/shared";
import { analyseLetter } from "../agents/analyseLetter";
import { prismaAgentStore } from "../agents/agentStore";
import type { DocumentCaseFile } from "../agents/documentCaseFile";
import { AgentLimitError, Orchestrator } from "../agents/orchestrator";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm";
import { LLMValidationError } from "../llm/generateStructured";
import type { DocumentJobData } from "./documentQueue";

async function report(job: Job<DocumentJobData>, event: ProgressEvent): Promise<void> {
  await job.updateProgress(event);
}

/** Stored on the document and shown in the UI: never raw provider errors */
function userError(err: unknown): { message: string; code: ErrorCode } {
  if (err instanceof LLMError) return { message: err.userMessage, code: err.code };
  if (err instanceof LLMValidationError) {
    return { message: "The AI returned an incomplete analysis. Please try again.", code: "AI_INCOMPLETE" };
  }
  return { message: "Something went wrong while processing this letter.", code: "PROCESSING_FAILED" };
}

function isRetryable(err: unknown): boolean {
  if (err instanceof LLMError) return err.retryable;
  if (err instanceof AgentLimitError) return false; // the same plan would hit the same limit
  return true; // validation, database, file errors: worth another try
}

/**
 * The job of an uploaded letter. Each attempt is one agent run: the orchestrator lets the agents
 * analyse the letter (agents/analyseLetter.ts) and stores their messages.
 */
export async function processDocument(job: Job<DocumentJobData>): Promise<void> {
  const store = prismaAgentStore;
  const { documentId } = job.data;
  const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  let runId: string | undefined;

  try {
    const doc = await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING", errorMessage: null, errorCode: null },
      include: { user: { select: { preferredLanguage: true } } },
    });

    const language = doc.user.preferredLanguage;
    const caseFile: DocumentCaseFile = {
      documentId,
      fileKey: doc.fileKey,
      mimeType: doc.mimeType,
      language: isExplanationLanguage(language) ? language : null,
    };
    runId = (await store.startRun(documentId, "UPLOAD")).id;
    const orchestrator = new Orchestrator(runId, caseFile, {
      store,
      onProgress: (event) => report(job, event),
    });

    await analyseLetter(orchestrator);

    await prisma.document.update({ where: { id: documentId }, data: { status: "DONE" } });
    await store.finishRun(runId, "DONE");

    await report(job, { status: "DONE" });
  } catch (err) {
    const { message, code } = userError(err);
    const retryable = isRetryable(err);

    if (runId) {
      await store.finishRun(runId, "FAILED", code).catch((finishErr: unknown) =>
        console.error(`Could not close agent run ${runId}:`, finishErr),
      );
    }

    if (!retryable || isLastAttempt) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED", errorMessage: message, errorCode: code },
      });
      await report(job, { status: "FAILED", message, code });
    } else {
      await report(job, { status: "PROCESSING", step: "retrying", message, code });
    }

    // UnrecoverableError tells BullMQ to skip the remaining attempts (e.g. invalid API key)
    if (!retryable) throw new UnrecoverableError(err instanceof Error ? err.message : message);
    throw err;
  }
}
