import { Worker } from "bullmq";
import "./config/env";
import { processDocument } from "./jobs/processDocument";
import { prisma } from "./lib/prisma";
import { createRedisConnection } from "./lib/redis";
import { DOCUMENT_QUEUE, type DocumentJobData } from "./queue/constants";
import { MAINTENANCE_QUEUE, scheduleRetentionChecks } from "./queue/maintenanceQueue";
import { REMINDER_QUEUE, scheduleReminderChecks } from "./queue/reminderQueue";
import { deleteExpiredDocuments } from "./privacy/userData";
import { fireDueReminders } from "./reminders/reminders";
import { todayInGermany } from "./replies/composeReplyLetter";

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

/** Fires reminders whose day has come; the job is added by a scheduler every few minutes */
const reminderWorker = new Worker(
  REMINDER_QUEUE,
  async () => {
    const fired = await fireDueReminders(todayInGermany());
    if (fired > 0) console.log(`Fired ${fired} reminder(s)`);
    return fired;
  },
  { connection: createRedisConnection() },
);
reminderWorker.on("failed", (_job, err) => console.error("Reminder check failed:", err.message));

const reminderQueue = scheduleReminderChecks().catch((err: unknown) => {
  console.error("Could not schedule reminder checks:", err);
  return null;
});

/** Deletes letters whose retention period (chosen in the settings) has passed */
const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE,
  async () => {
    const deleted = await deleteExpiredDocuments();
    if (deleted > 0) console.log(`Deleted ${deleted} letter(s) after their retention period`);
    return deleted;
  },
  { connection: createRedisConnection() },
);
maintenanceWorker.on("failed", (_job, err) => console.error("Retention check failed:", err.message));

const maintenanceQueue = scheduleRetentionChecks().catch((err: unknown) => {
  console.error("Could not schedule retention checks:", err);
  return null;
});

const shutdown = async () => {
  await Promise.allSettled([
    worker.close(),
    reminderWorker.close(),
    maintenanceWorker.close(),
    reminderQueue.then((q) => q?.close()),
    maintenanceQueue.then((q) => q?.close()),
  ]);
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
