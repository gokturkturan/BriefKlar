import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis";

export const REMINDER_QUEUE = "reminders";

/** How often the worker looks for reminders whose day has come */
export const REMINDER_CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * A BullMQ job scheduler (a repeatable job stored in Redis) adds a "fire-due-reminders" job
 * every few minutes (the first one right away). Upserting it on every worker start is safe:
 * there is only ever one.
 */
export async function scheduleReminderChecks(): Promise<Queue> {
  const queue = new Queue(REMINDER_QUEUE, { connection: createRedisConnection() });
  await queue.upsertJobScheduler(
    "fire-due-reminders",
    { every: REMINDER_CHECK_EVERY_MS },
    { name: "fire-due-reminders", opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } } },
  );
  return queue;
}
