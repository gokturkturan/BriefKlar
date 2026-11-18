import type { Job } from "bullmq";
import type { ProgressEvent, ProcessingStep } from "@briefklar/shared";
import { prisma } from "../lib/prisma";
import type { DocumentJobData } from "../queue/constants";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function report(job: Job<DocumentJobData>, event: ProgressEvent): Promise<void> {
  await job.updateProgress(event);
}

/**
 * Week 1: a placeholder pipeline that only simulates the steps,
 * so the whole flow (upload -> queue -> worker -> SSE -> UI) can be tested end to end.
 * Week 2 replaces the sleep() calls with text extraction and the LLM call.
 */
export async function processDocument(job: Job<DocumentJobData>): Promise<void> {
  const { documentId } = job.data;
  const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING", errorMessage: null },
    });

    const steps: ProcessingStep[] = ["preprocessing", "extracting", "analyzing"];
    for (const step of steps) {
      await report(job, { status: "PROCESSING", step });
      await sleep(1500); // TODO(week 2): real work
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: "DONE" } });
    await report(job, { status: "DONE" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (isFinalAttempt) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED", errorMessage: message },
      });
      await report(job, { status: "FAILED", message });
    } else {
      await report(job, { status: "PROCESSING", step: "retrying", message });
    }
    throw err; // let BullMQ handle retries / mark the job as failed
  }
}
