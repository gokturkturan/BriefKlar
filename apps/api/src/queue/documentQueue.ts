import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis";

import { DOCUMENT_QUEUE, type DocumentJobData } from "./constants";

export { DOCUMENT_QUEUE, type DocumentJobData };

export const documentQueue = new Queue<DocumentJobData>(DOCUMENT_QUEUE, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function enqueueDocument(documentId: string): Promise<void> {
  // jobId = documentId, so progress events can be routed to the right SSE client
  await documentQueue.add("process", { documentId }, { jobId: documentId });
}
