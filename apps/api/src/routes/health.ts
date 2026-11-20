import { Router } from "express";
import type { HealthDto } from "@briefklar/shared";
import { prisma } from "../lib/prisma";
import { createRedisConnection } from "../lib/redis";
import { documentQueue } from "../queue/documentQueue";

const redisClient = createRedisConnection();

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const [db, redis] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redisClient.ping(),
  ]);

  const workers = redis.status === "fulfilled" ? (await documentQueue.getWorkers()).length : 0;

  const ok = db.status === "fulfilled" && redis.status === "fulfilled";
  const body: HealthDto = {
    status: ok ? (workers > 0 ? "ok" : "degraded") : "down",
    database: db.status === "fulfilled" ? "up" : "down",
    redis: redis.status === "fulfilled" ? "up" : "down",
    workers,
  };
  res.status(ok ? 200 : 503).json(body);
});
