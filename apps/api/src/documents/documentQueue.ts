import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis";

export const DOCUMENT_QUEUE = "document-processing";

export interface DocumentJobData {
  documentId: string;
}

export const documentQueue = new Queue<DocumentJobData>(DOCUMENT_QUEUE, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    // LLM APIs are regularly overloaded for short periods: 5 attempts, waiting 5s, 10s, 20s, 40s
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function enqueueDocument(documentId: string): Promise<void> {
  // jobId = documentId, so progress events can be routed to the right SSE client.
  // BullMQ ignores a job whose id already exists, so a finished job is removed first.
  const existing = await documentQueue.getJob(documentId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active" || state === "waiting" || state === "delayed") return;
    await existing.remove();
  }
  await documentQueue.add("process", { documentId }, { jobId: documentId });
}
