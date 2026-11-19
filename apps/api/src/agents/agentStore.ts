import { Prisma } from "@prisma/client";
import type { AgentMessage, AgentRunStatus, AgentRunTrigger } from "@briefklar/shared";
import { prisma } from "../lib/prisma";

/** Where runs and their messages are kept; an interface so the orchestrator can be tested without a database */
export interface AgentStore {
  startRun(documentId: string, trigger: AgentRunTrigger): Promise<{ id: string }>;
  /** Stores a message and counts it as a hop of its run */
  recordMessage(message: AgentMessage): Promise<void>;
  /** Model requests made in the run so far */
  llmCallCount(runId: string): Promise<number>;
  finishRun(runId: string, status: Exclude<AgentRunStatus, "RUNNING">, errorCode?: string): Promise<void>;
}

export const prismaAgentStore: AgentStore = {
  async startRun(documentId, trigger) {
    return prisma.agentRun.create({ data: { documentId, trigger }, select: { id: true } });
  },

  async recordMessage(message) {
    await prisma.$transaction([
      prisma.agentMessage.create({
        data: {
          id: message.id,
          runId: message.runId,
          parentId: message.parentId,
          from: message.from,
          to: message.to,
          kind: message.payload.kind,
          hop: message.hop,
          payload: message.payload as Prisma.InputJsonValue,
          createdAt: new Date(message.createdAt),
        },
      }),
      prisma.agentRun.update({ where: { id: message.runId }, data: { hops: message.hop + 1 } }),
    ]);
  },

  async llmCallCount(runId) {
    const run = await prisma.agentRun.findUnique({ where: { id: runId }, select: { llmCalls: true } });
    return run?.llmCalls ?? 0;
  },

  async finishRun(runId, status, errorCode) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status, errorCode: errorCode ?? null, finishedAt: new Date() },
    });
  },
};
