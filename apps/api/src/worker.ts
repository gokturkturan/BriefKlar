import { Queue, Worker } from "bullmq";
import "./config/env";
import { todayInGermany } from "./deadlines/calendarDate";
import { processDocument } from "./jobs/processDocument";
import { prisma } from "./lib/prisma";
import { createRedisConnection } from "./lib/redis";
import { deleteExpiredDocuments } from "./privacy/userData";
import { DOCUMENT_QUEUE, type DocumentJobData } from "./queue/constants";
import { fireDueReminders } from "./reminders/reminders";

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

/**
 * Runs `task` every `everyMs`, the first time right away. A BullMQ job scheduler (a repeatable
 * job stored in Redis under `schedulerId`) adds the jobs. Upserting it on every start is safe:
 * there is only ever one. The task returns a line to log, or nothing.
 */
function runEvery(queueName: string, schedulerId: string, everyMs: number, task: () => Promise<string | null>) {
  const repeatingWorker = new Worker(
    queueName,
    async () => {
      const message = await task();
      if (message) console.log(message);
    },
    { connection: createRedisConnection() },
  );
  repeatingWorker.on("failed", (_job, err) => console.error(`${schedulerId} failed:`, err.message));

  const queue = new Queue(queueName, { connection: createRedisConnection() });
  const scheduled = queue
    .upsertJobScheduler(
      schedulerId,
      { every: everyMs },
      { name: schedulerId, opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } } },
    )
    .catch((err: unknown) => console.error(`Could not schedule ${schedulerId}:`, err));

  return () => Promise.allSettled([repeatingWorker.close(), scheduled.then(() => queue.close())]);
}

const MINUTE = 60 * 1000;

/** Reminders whose day has come show up on the reminders page */
const stopReminders = runEvery("reminders", "fire-due-reminders", 5 * MINUTE, async () => {
  const fired = await fireDueReminders(todayInGermany());
  return fired > 0 ? `Fired ${fired} reminder(s)` : null;
});

/** Letters whose retention period (chosen in the settings) has passed are deleted */
const stopRetention = runEvery("maintenance", "delete-expired-letters", 60 * MINUTE, async () => {
  const deleted = await deleteExpiredDocuments();
  return deleted > 0 ? `Deleted ${deleted} letter(s) after their retention period` : null;
});

const shutdown = async () => {
  await Promise.allSettled([worker.close(), stopReminders(), stopRetention()]);
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
