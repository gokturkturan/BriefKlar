import { Router } from "express";
import { prisma } from "../lib/prisma";
import { documentQueue } from "../documents/documentQueue";

/**
 * Development-only overview of documents, queue jobs, agent runs (with the messages between the
 * agents, in order) and LLM calls.
 * Mounted only when NODE_ENV=development (see app.ts).
 */
export const debugRouter = Router();

debugRouter.get("/overview", async (_req, res) => {
  const [documents, llmCalls, counts, jobs, agentRuns] = await Promise.all([
    prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, originalName: true, status: true, errorMessage: true, createdAt: true, updatedAt: true,
        _count: { select: { extractions: true, actionItems: true, deadlines: true } },
      },
    }),
    prisma.llmCall.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    documentQueue.getJobCounts(),
    documentQueue.getJobs(["active", "waiting", "delayed", "failed", "completed"], 0, 50),
    prisma.agentRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: {
        messages: {
          orderBy: { hop: "asc" },
          select: { hop: true, from: true, to: true, kind: true, payload: true, createdAt: true },
        },
      },
    }),
  ]);

  const jobStates = await Promise.all(
    jobs.map(async (job) => ({
      id: job.id,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      progress: job.progress,
      failedReason: job.failedReason,
      timestamp: new Date(job.timestamp).toISOString(),
      processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    })),
  );

  const workers = await documentQueue.getWorkers();

  res.json({ queue: { counts, workers: workers.length, jobs: jobStates }, documents, agentRuns, llmCalls });
});
