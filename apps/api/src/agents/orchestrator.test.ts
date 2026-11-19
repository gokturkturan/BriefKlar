import { describe, expect, it, vi } from "vitest";
import { AgentMessageSchema, type AgentMessage, type ProgressEvent } from "@briefklar/shared";
import { LLMError } from "../llm/errors";
import { currentAgentScope } from "./agentScope";
import type { AgentStore } from "./agentStore";
import { analyseLetter, type LetterAgents } from "./analyseLetter";
import type { DocumentCaseFile } from "./documentCaseFile";
import { AgentLimitError, Orchestrator } from "./orchestrator";
import type { Agent, AgentReply } from "./types";

vi.mock("../lib/prisma", () => ({ prisma: {} }));

function memoryStore(llmCalls = 0) {
  const messages: AgentMessage[] = [];
  const store: AgentStore = {
    startRun: async () => ({ id: "00000000-0000-4000-8000-000000000001" }),
    recordMessage: async (message) => {
      messages.push(message);
    },
    llmCallCount: async () => llmCalls,
    finishRun: async () => {},
  };
  return { store, messages };
}

const RUN_ID = "00000000-0000-4000-8000-000000000001";

function caseFile(language: DocumentCaseFile["language"] = "tr"): DocumentCaseFile {
  return { documentId: "doc-1", fileKey: "file-1", mimeType: "application/pdf", language };
}

function fakeAgent(
  name: Agent<DocumentCaseFile>["name"],
  handle: Agent<DocumentCaseFile>["handle"] = async () => ({ kind: "result", wrote: [], summary: name }),
): Agent<DocumentCaseFile> {
  return { name, handle: vi.fn(handle) };
}

function orchestrator(store: AgentStore, file = caseFile(), onProgress = vi.fn(async (_e: ProgressEvent) => {})) {
  return new Orchestrator(RUN_ID, file, { store, onProgress });
}

describe("Orchestrator", () => {
  it("stores the task and the reply as linked, valid messages", async () => {
    const { store, messages } = memoryStore();
    const agent = fakeAgent("extractor");

    const reply = await orchestrator(store).dispatch(agent, "Analyse the letter");

    expect(reply).toEqual({ kind: "result", wrote: [], summary: "extractor" });
    expect(messages.map((m) => [m.hop, m.from, m.to, m.payload.kind])).toEqual([
      [0, "orchestrator", "extractor", "task"],
      [1, "extractor", "orchestrator", "result"],
    ]);
    expect(messages[1].parentId).toBe(messages[0].id);
    for (const message of messages) expect(AgentMessageSchema.parse(message)).toEqual(message);
  });

  it("runs the agent inside its scope, so model requests are logged with the run and the agent", async () => {
    const { store } = memoryStore();
    let scope;
    const agent = fakeAgent("deadline", async () => {
      scope = currentAgentScope();
      return { kind: "result", wrote: ["deadlines"], summary: "" };
    });

    await orchestrator(store).dispatch(agent, "Compute");

    expect(scope).toEqual({ runId: RUN_ID, agent: "deadline" });
    expect(currentAgentScope()).toBeUndefined();
  });

  it("reports the steps of an agent with its name", async () => {
    const { store } = memoryStore();
    const onProgress = vi.fn(async (_e: ProgressEvent) => {});
    const agent = fakeAgent("extractor", async (_task, { report }) => {
      await report("extracting");
      return { kind: "result", wrote: ["extraction"], summary: "" };
    });

    await orchestrator(store, caseFile(), onProgress).dispatch(agent, "Analyse");

    expect(onProgress).toHaveBeenCalledWith({ status: "PROCESSING", step: "extracting", agent: "extractor" });
  });

  it("stores a failure as an error message and throws it on unchanged", async () => {
    const { store, messages } = memoryStore();
    const error = new LLMError("overloaded", true, "Try again", "AI_OVERLOADED", 503, "big");
    const agent = fakeAgent("extractor", () => Promise.reject(error));

    await expect(orchestrator(store).dispatch(agent, "Analyse")).rejects.toBe(error);

    expect(messages[1]).toMatchObject({
      from: "extractor",
      to: "orchestrator",
      payload: { kind: "error", code: "AI_OVERLOADED", retryable: true },
    });
  });

  it("stops a run that would exceed the message limit", async () => {
    const { store } = memoryStore();
    const run = new Orchestrator(RUN_ID, caseFile(), { store, onProgress: async () => {}, maxHops: 3 });
    const agent = fakeAgent("extractor");

    await run.dispatch(agent, "first");
    await expect(run.dispatch(agent, "second")).rejects.toBeInstanceOf(AgentLimitError);
    expect(agent.handle).toHaveBeenCalledTimes(1);
  });

  it("stops a run that used up its model requests", async () => {
    const { store, messages } = memoryStore(6);
    const agent = fakeAgent("extractor");

    await expect(orchestrator(store).dispatch(agent, "Analyse")).rejects.toMatchObject({ limit: "llmCalls" });
    expect(agent.handle).not.toHaveBeenCalled();
    expect(messages).toEqual([]);
  });
});

describe("analyseLetter", () => {
  function agents(order: string[]): LetterAgents {
    const track =
      (name: Agent<DocumentCaseFile>["name"]) =>
      async (): Promise<AgentReply> => {
        order.push(name);
        return { kind: "result", wrote: [], summary: "" };
      };
    return {
      extractor: fakeAgent("extractor", track("extractor")),
      deadline: fakeAgent("deadline", track("deadline")),
      translator: fakeAgent("translator", track("translator")),
    };
  }

  it("extracts, stores with deadlines, then translates", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    await analyseLetter(orchestrator(store, caseFile("tr")), agents(order));

    expect(order).toEqual(["extractor", "deadline", "translator"]);
    expect(messages).toHaveLength(6);
  });

  it("skips the translator for English readers and unknown languages", async () => {
    for (const language of ["en", null] as const) {
      const order: string[] = [];
      const { store } = memoryStore();
      await analyseLetter(orchestrator(store, caseFile(language)), agents(order));
      expect(order).toEqual(["extractor", "deadline"]);
    }
  });

  it("does not store anything when the extractor does not return an analysis", async () => {
    const order: string[] = [];
    const letterAgents = agents(order);
    letterAgents.extractor = fakeAgent("extractor", async () => ({
      kind: "question",
      askUser: true,
      question: "OTHER",
      text: "Unreadable",
    }));
    const { store } = memoryStore();

    await expect(analyseLetter(orchestrator(store), letterAgents)).rejects.toThrow("Unexpected question");
    expect(order).toEqual([]);
  });
});
