import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis";

export const MAINTENANCE_QUEUE = "maintenance";

/** How often the worker deletes letters whose retention period has passed */
export const RETENTION_CHECK_EVERY_MS = 60 * 60 * 1000;

/** Like the reminder checks: a job scheduler in Redis, upserted on every worker start */
export async function scheduleRetentionChecks(): Promise<Queue> {
  const queue = new Queue(MAINTENANCE_QUEUE, { connection: createRedisConnection() });
  await queue.upsertJobScheduler(
    "delete-expired-letters",
    { every: RETENTION_CHECK_EVERY_MS },
    { name: "delete-expired-letters", opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 500 } } },
  );
  return queue;
}
