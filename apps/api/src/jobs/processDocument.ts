import { UnrecoverableError, type Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { isExplanationLanguage, type ErrorCode, type ProgressEvent } from "@briefklar/shared";
import { deadlineContext, deadlineRows } from "../deadlines";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm";
import { extractLetter } from "../llm/extractLetter";
import { LLMValidationError } from "../llm/generateStructured";
import { EXTRACT_LETTER_PROMPT_VERSION } from "../prompts/extractLetter";
import type { DocumentJobData } from "../queue/constants";
import { storage } from "../storage";
import { ANALYSIS_LANGUAGE, getOrCreateTranslation } from "../translations/analysisTranslations";

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
  return true; // validation, database, file errors: worth another try
}

export async function processDocument(job: Job<DocumentJobData>): Promise<void> {
  const { documentId } = job.data;
  const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

  try {
    const doc = await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING", errorMessage: null, errorCode: null },
      include: { user: { select: { preferredLanguage: true } } },
    });

    await report(job, { status: "PROCESSING", step: "preprocessing" });
    const file = await storage.read(doc.fileKey);

    await report(job, { status: "PROCESSING", step: "extracting" });
    const { data: extraction, model } = await extractLetter({
      file,
      mimeType: doc.mimeType,
      documentId,
    });

    await report(job, { status: "PROCESSING", step: "saving" });
    const saved = await prisma.$transaction(async (tx) => {
      const row = await tx.extraction.create({
        data: {
          documentId,
          data: extraction as unknown as Prisma.InputJsonValue,
          urgency: extraction.urgency,
          model,
          promptVersion: EXTRACT_LETTER_PROMPT_VERSION,
        },
      });

      // Replace instead of append, so a re-run never creates duplicates
      await tx.actionItem.deleteMany({ where: { documentId } });
      await tx.deadline.deleteMany({ where: { documentId } });
      // Explanations are based on the old analysis and its deadlines
      await tx.explanation.deleteMany({ where: { documentId } });

      await tx.actionItem.createMany({
        data: extraction.requiredActions.map((text, position) => ({ documentId, text, position })),
      });
      await tx.deadline.createMany({
        data: deadlineRows(documentId, extraction, await deadlineContext(documentId, tx)),
      });
      return row;
    });

    // The analysis is written in English; translate it now, so the letter opens in the
    // user's language. Not critical: the page asks for the translation again if this fails.
    const language = doc.user.preferredLanguage;
    if (isExplanationLanguage(language) && language !== ANALYSIS_LANGUAGE) {
      await report(job, { status: "PROCESSING", step: "translating" });
      await getOrCreateTranslation(saved, language).catch((err: unknown) => {
        console.warn(`Translation into ${language} failed for ${documentId}:`, err);
      });
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: "DONE" } });

    await report(job, { status: "DONE" });
  } catch (err) {
    const { message, code } = userError(err);
    const retryable = isRetryable(err);

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
