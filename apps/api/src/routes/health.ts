import { Router } from "express";
import { prisma } from "../lib/prisma";
import { documentQueue } from "../queue/documentQueue";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const [db, redis] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    documentQueue.client.then((client) => client.ping()),
  ]);

  const ok = db.status === "fulfilled" && redis.status === "fulfilled";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    database: db.status === "fulfilled" ? "up" : "down",
    redis: redis.status === "fulfilled" ? "up" : "down",
  });
});
