import { Worker } from "bullmq";
import "./config/env";
import { processDocument } from "./jobs/processDocument";
import { prisma } from "./lib/prisma";
import { createRedisConnection } from "./lib/redis";
import { DOCUMENT_QUEUE, type DocumentJobData } from "./queue/constants";

/**
 * Separate process from the API: heavy LLM work never blocks HTTP requests,
 * and workers can be scaled independently.
 */
const worker = new Worker<DocumentJobData>(DOCUMENT_QUEUE, processDocument, {
  connection: createRedisConnection(),
  concurrency: 2,
});

worker.on("ready", () => console.log(`Worker listening on queue "${DOCUMENT_QUEUE}"`));
worker.on("completed", (job) => console.log(`Job ${job.id} completed`));
worker.on("failed", (job, err) =>
  console.error(`Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message),
);

const shutdown = async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
