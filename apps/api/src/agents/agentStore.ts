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
  finishRun(runId: string, status: Extract<AgentRunStatus, "DONE" | "FAILED">, errorCode?: string): Promise<void>;
  /** An agent asked the user a question: the run stops until the answer */
  waitForUser(runId: string): Promise<void>;
  /** Takes up a waiting run again; false when it is no longer waiting (answered twice, replaced) */
  resumeRun(runId: string): Promise<boolean>;
}

export const prismaAgentStore: AgentStore = {
  async startRun(documentId, trigger) {
    // A new analysis replaces the old one: a question of an earlier run is no longer asked.
    // The same for a new reply from the chat; an upload and a chat do not replace each other.
    await prisma.agentRun.updateMany({
      where: { documentId, trigger, status: "WAITING_FOR_USER" },
      data: { status: "DONE", errorCode: "SUPERSEDED", finishedAt: new Date() },
    });
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

  async waitForUser(runId) {
    await prisma.agentRun.update({ where: { id: runId }, data: { status: "WAITING_FOR_USER", finishedAt: null } });
  },

  async resumeRun(runId) {
    const { count } = await prisma.agentRun.updateMany({
      where: { id: runId, status: "WAITING_FOR_USER" },
      data: { status: "RUNNING" },
    });
    return count === 1;
  },
};
