import { Redis } from "ioredis";
import { env } from "../config/env";

/**
 * BullMQ needs separate connections for Queue, Worker and QueueEvents,
 * so we create a new one each time instead of sharing a single client.
 * maxRetriesPerRequest must be null for BullMQ's blocking commands.
 */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
