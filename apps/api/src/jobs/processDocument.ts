import { UnrecoverableError, type Job } from "bullmq";
import { Prisma } from "@prisma/client";
import type { LetterExtraction, ProgressEvent } from "@briefklar/shared";
import { computeRelativeDeadline } from "../deadlines";
import { resolveExplicitDate } from "../lib/germanDates";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm";
import { extractLetter } from "../llm/extractLetter";
import { LLMValidationError } from "../llm/generateStructured";
import { EXTRACT_LETTER_PROMPT_VERSION } from "../prompts/extractLetter";
import type { DocumentJobData } from "../queue/constants";
import { storage } from "../storage";

async function report(job: Job<DocumentJobData>, event: ProgressEvent): Promise<void> {
  await job.updateProgress(event);
}

/**
 * Due dates for the extracted deadlines, all decided by code:
 * - a date written in the wording wins. The model's explicitDate is cross-checked against
 *   the text, because models do misread dates.
 * - otherwise relative wording ("innerhalb eines Monats nach Bekanntgabe") is computed
 *   from the letter date with the rules of German law.
 * Deadlines that neither way gives a date for are only shown as text.
 */
function deadlineRows(documentId: string, extraction: LetterExtraction) {
  return extraction.deadlines.flatMap((deadline) => {
    const base = { documentId, kind: deadline.kind, sourceText: deadline.rawText };

    const date = resolveExplicitDate(deadline.rawText, deadline.explicitDate);
    if (deadline.explicitDate && date !== deadline.explicitDate) {
      console.warn(
        `Deadline date corrected for ${documentId}: model said ${deadline.explicitDate}, ` +
          `text "${deadline.rawText}" gives ${date ?? "no date"}`,
      );
    }
    if (date) return [{ ...base, dueDate: new Date(`${date}T00:00:00Z`) }];

    const computed = computeRelativeDeadline({
      rawText: deadline.rawText,
      letterDate: extraction.letterDate,
      senderType: extraction.sender.type,
    });
    if (!computed.ok) {
      console.info(`No due date for "${deadline.rawText}" (${documentId}): ${computed.reason}`);
      return [];
    }
    return [
      {
        ...base,
        dueDate: new Date(`${computed.dueDate}T00:00:00Z`),
        isEstimate: computed.isEstimate,
        explanation: computed.explanation,
      },
    ];
  });
}

/** Message stored on the document and shown in the UI: never raw provider errors */
function userMessage(err: unknown): string {
  if (err instanceof LLMError) return err.userMessage;
  if (err instanceof LLMValidationError) return "The AI returned an incomplete analysis. Please try again.";
  return "Something went wrong while processing this letter.";
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
      data: { status: "PROCESSING", errorMessage: null },
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
    await prisma.$transaction(async (tx) => {
      await tx.extraction.create({
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
      await tx.deadline.createMany({ data: deadlineRows(documentId, extraction) });

      await tx.document.update({ where: { id: documentId }, data: { status: "DONE" } });
    });

    await report(job, { status: "DONE" });
  } catch (err) {
    const message = userMessage(err);
    const retryable = isRetryable(err);

    if (!retryable || isLastAttempt) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED", errorMessage: message },
      });
      await report(job, { status: "FAILED", message });
    } else {
      await report(job, { status: "PROCESSING", step: "retrying", message });
    }

    // UnrecoverableError tells BullMQ to skip the remaining attempts (e.g. invalid API key)
    if (!retryable) throw new UnrecoverableError(err instanceof Error ? err.message : message);
    throw err;
  }
}
