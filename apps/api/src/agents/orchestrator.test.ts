import { describe, expect, it, vi } from "vitest";
import {
  AgentMessageSchema,
  MAX_AGENT_HOPS,
  type AgentIssue,
  type AgentMessage,
  type IntakeResult,
  type LetterExtraction,
  type ProgressEvent,
} from "@briefklar/shared";
import { LLMError } from "../llm/errors";
import { currentAgentScope } from "./agentScope";
import type { AgentStore } from "./agentStore";
import { analyseLetter, UnreadableScanError, type LetterAgents } from "./analyseLetter";
import type { DocumentCaseFile } from "./documentCaseFile";
import { AgentLimitError, Orchestrator } from "./orchestrator";
import type { Agent, AgentReply, AgentTask } from "./types";

vi.mock("../lib/prisma", () => ({ prisma: {} }));

function memoryStore(llmCalls = 0) {
  const messages: AgentMessage[] = [];
  const store: AgentStore = {
    startRun: async () => ({ id: "00000000-0000-4000-8000-000000000001" }),
    recordMessage: async (message) => {
      messages.push(message);
    },
    llmCallCount: async () => llmCalls,
    finishRun: vi.fn(async () => {}),
    waitForUser: vi.fn(async () => {}),
    resumeRun: vi.fn(async () => true),
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
  return { name, usesModel: name !== "deadline", handle: vi.fn(handle) };
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

  it("runs an agent without model requests at the request limit", async () => {
    const { store } = memoryStore(6);
    const agent = fakeAgent("deadline");

    await orchestrator(store).dispatch(agent, "Compute");
    expect(agent.handle).toHaveBeenCalledTimes(1);
  });
});

const ANALYSIS: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "The tax office wants money.",
  sender: { name: "Finanzamt", type: "FINANZAMT" },
  letterType: "BESCHEID",
  letterDate: "2026-09-14",
  subject: "Einkommensteuer",
  references: [],
  amounts: [{ value: 124, currency: "EUR", purpose: "tax" }],
  deadlines: [],
  requiredActions: [],
  requiredDocuments: [],
  objectionPossible: true,
  urgency: "HIGH",
  uncertainFields: [],
};

const OFFICIAL: IntakeResult = {
  isOfficialLetter: true,
  letterType: "BESCHEID",
  language: "de",
  scanQuality: "GOOD",
  senderName: "Finanzamt",
  summary: "A tax assessment.",
};

const INVITATION: IntakeResult = {
  isOfficialLetter: false,
  letterType: "OTHER",
  language: "de",
  scanQuality: "GOOD",
  senderName: "Anna",
  summary: "A private invitation to a birthday party.",
};

const ISSUE: AgentIssue = {
  field: "amounts[0].value",
  problem: "The letter says 1,240.00 EUR",
  evidence: "Bitte zahlen Sie 1.240,00 €",
};

describe("analyseLetter", () => {
  /**
   * Fake agents that note their order; the intake agent classifies the upload as `intake` (and
   * writes a short analysis when it is not an official letter), the extractor writes an
   * analysis, each one uses `calls` model requests
   */
  function agents(
    order: string[],
    verdicts: AgentReply[] = [],
    calls = { used: 0 },
    intake: IntakeResult | null = OFFICIAL,
  ): LetterAgents {
    const track =
      (name: Agent<DocumentCaseFile>["name"], requests: number) =>
      async (task: AgentTask, { caseFile }: { caseFile: DocumentCaseFile }): Promise<AgentReply> => {
        order.push(task.notes.length > 0 ? `${name}+notes` : name);
        calls.used += requests;
        if (name === "extractor") caseFile.extraction = { ...ANALYSIS };
        if (name === "intake" && intake) {
          caseFile.intake = { ...intake, model: "fake" };
          if (!intake.isOfficialLetter) caseFile.extraction = { ...ANALYSIS, isOfficialLetter: false };
        }
        if (name === "verifier") return verdicts.shift() ?? { kind: "result", wrote: ["verdict"], summary: "ok" };
        return { kind: "result", wrote: [], summary: "" };
      };
    return {
      intake: fakeAgent("intake", track("intake", 1)),
      extractor: fakeAgent("extractor", track("extractor", 1)),
      verifier: fakeAgent("verifier", track("verifier", 1)),
      deadline: fakeAgent("deadline", track("deadline", 0)),
      translator: fakeAgent("translator", track("translator", 1)),
    };
  }

  /** A store that counts the fake agents' model requests */
  function countingStore(calls: { used: number }) {
    const memory = memoryStore();
    memory.store.llmCallCount = async () => calls.used;
    return memory;
  }

  const revise: AgentReply = { kind: "revise", target: "extraction", issues: [ISSUE] };

  it("classifies, extracts, verifies, stores with deadlines, then translates", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    await analyseLetter(orchestrator(store, caseFile("tr")), agents(order));

    expect(order).toEqual(["intake", "extractor", "verifier", "deadline", "translator"]);
    expect(messages).toHaveLength(10);
  });

  it("stores the intake's description of a document that is not an official letter, without the extractor", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    const file = caseFile("tr");
    await analyseLetter(orchestrator(store, file), agents(order, [], { used: 0 }, INVITATION));

    expect(order).toEqual(["intake", "deadline", "translator"]);
    // Trace check: neither the extractor nor the verifier got a task
    expect(messages.filter((m) => m.to === "extractor" || m.to === "verifier")).toEqual([]);
    expect(file.extraction?.isOfficialLetter).toBe(false);
  });

  it("stops before the analysis when the scan cannot be read", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    const unreadable: IntakeResult = { ...OFFICIAL, scanQuality: "UNREADABLE" };
    // Unreadable wins over "not an official letter": nothing reliable can be said about it
    for (const intake of [unreadable, { ...unreadable, isOfficialLetter: false }]) {
      order.length = 0;
      await expect(
        analyseLetter(orchestrator(store, caseFile("tr")), agents(order, [], { used: 0 }, intake)),
      ).rejects.toBeInstanceOf(UnreadableScanError);
      expect(order).toEqual(["intake"]);
    }
  });

  it("goes on with a poor scan; the page shows the warning", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    const file = caseFile("en");
    await analyseLetter(orchestrator(store, file), agents(order, [], { used: 0 }, { ...OFFICIAL, scanQuality: "POOR" }));

    expect(order).toEqual(["intake", "extractor", "verifier", "deadline"]);
    expect(file.intake?.scanQuality).toBe("POOR");
  });

  it("analyses the letter in full when the intake agent could not decide", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    await analyseLetter(orchestrator(store, caseFile("en")), agents(order, [], { used: 0 }, null));

    expect(order).toEqual(["intake", "extractor", "verifier", "deadline"]);
  });

  it("leaves the intake out when the user asked for the full analysis", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    const file = { ...caseFile("en"), skipIntake: true };
    await analyseLetter(orchestrator(store, file), agents(order, [], { used: 0 }, INVITATION));

    expect(order).toEqual(["extractor", "verifier", "deadline"]);
  });

  it("skips the translator for English readers and unknown languages", async () => {
    for (const language of ["en", null] as const) {
      const order: string[] = [];
      const { store } = memoryStore();
      await analyseLetter(orchestrator(store, caseFile(language)), agents(order));
      expect(order).toEqual(["intake", "extractor", "verifier", "deadline"]);
    }
  });

  it("passes the verifier's issues to the extractor once and checks the correction", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    const file = caseFile("tr");
    const letterAgents = agents(order, [revise]);
    await analyseLetter(orchestrator(store, file), letterAgents);

    expect(order).toEqual(["intake", "extractor", "verifier", "extractor+notes", "verifier", "deadline", "translator"]);
    const reviseMessage = messages.find((m) => m.payload.kind === "revise")!;
    const correction = messages[reviseMessage.hop + 1];
    expect(correction).toMatchObject({ from: "orchestrator", to: "extractor", parentId: reviseMessage.id });
    expect(correction.payload).toMatchObject({ kind: "task", notes: [ISSUE] });
    expect(file.extraction?.uncertainFields).toEqual([]);
    // The longest plan fits the message limit
    expect(messages).toHaveLength(14);
    for (const message of messages) expect(AgentMessageSchema.parse(message)).toEqual(message);
  });

  it("marks the fields as uncertain that the verifier still disputes after the correction", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    const file = caseFile("en");
    await analyseLetter(orchestrator(store, file), agents(order, [revise, revise]));

    expect(order).toEqual(["intake", "extractor", "verifier", "extractor+notes", "verifier", "deadline"]);
    expect(file.extraction?.uncertainFields).toEqual(["amounts"]);
  });

  it("leaves the correction out when it would take the translation's model requests", async () => {
    const order: string[] = [];
    // The extraction needed a repair: with the intake 3 requests, the check 1, so 2 of 6 are left
    const calls = { used: 1 };
    const { store } = countingStore(calls);
    const file = caseFile("tr");
    const run = new Orchestrator(RUN_ID, file, { store, onProgress: async () => {}, maxLlmCalls: 6 });
    await analyseLetter(run, agents(order, [revise], calls));

    expect(order).toEqual(["intake", "extractor", "verifier", "deadline", "translator"]);
    expect(file.extraction?.uncertainFields).toEqual(["amounts"]);
  });

  it("keeps the first analysis, marked as uncertain, when the correction fails", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    const file = caseFile("en");
    const letterAgents = agents(order, [revise]);
    const extract = letterAgents.extractor.handle;
    letterAgents.extractor = fakeAgent("extractor", async (task, context) => {
      if (task.notes.length > 0) throw new LLMError("overloaded", true, "Try again", "AI_OVERLOADED", 503, "big");
      return extract(task, context);
    });
    await analyseLetter(orchestrator(store, file), letterAgents);

    expect(order).toEqual(["intake", "extractor", "verifier", "deadline"]);
    expect(file.extraction?.uncertainFields).toEqual(["amounts"]);
  });

  it("stores the analysis without a check when the run has no model requests left for it", async () => {
    const order: string[] = [];
    const calls = { used: 0 };
    const { store } = countingStore(calls);
    const run = new Orchestrator(RUN_ID, caseFile("en"), { store, onProgress: async () => {}, maxLlmCalls: 2 });
    await analyseLetter(run, agents(order, [], calls));

    expect(order).toEqual(["intake", "extractor", "deadline"]);
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
    expect(order).toEqual(["intake"]);
  });
});

describe("questions to the user (F3)", () => {
  const ask = (question: "RECEIVED_DATE" | "FEDERAL_STATE" | "REPLY_NOTES"): AgentReply => ({
    kind: "question",
    askUser: true,
    question,
    text: "When did the letter arrive?",
  });

  function letterAgents(order: string[], deadlineReplies: AgentReply[]): LetterAgents {
    const agent = (name: Agent<DocumentCaseFile>["name"]) =>
      fakeAgent(name, async (_task, { caseFile }) => {
        order.push(caseFile.answer ? `${name}+answer` : name);
        if (name === "extractor") caseFile.extraction = { ...ANALYSIS };
        if (name === "intake") caseFile.intake = { ...OFFICIAL, model: "fake" };
        if (name === "deadline") return deadlineReplies.shift() ?? { kind: "result", wrote: ["deadlines"], summary: "" };
        return { kind: "result", wrote: [], summary: name };
      });
    return {
      intake: agent("intake"),
      extractor: agent("extractor"),
      verifier: agent("verifier"),
      deadline: agent("deadline"),
      translator: agent("translator"),
    };
  }

  it("keeps the deadline agent's question, finishes the plan and lets the run wait", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    const run = orchestrator(store, caseFile("tr"));

    await analyseLetter(run, letterAgents(order, [ask("RECEIVED_DATE")]));

    // The analysis is stored and translated before the run waits: the page shows it at once
    expect(order).toEqual(["intake", "extractor", "verifier", "deadline", "translator"]);
    const question = messages.find((m) => m.payload.kind === "question")!;
    expect(run.pendingQuestion).toEqual({ messageId: question.id, agent: "deadline", question: "RECEIVED_DATE" });

    expect(await run.finish()).toBe("RECEIVED_DATE");
    expect(store.waitForUser).toHaveBeenCalledWith(RUN_ID);
    expect(store.finishRun).not.toHaveBeenCalled();
  });

  it("ends the run as done when no agent asked", async () => {
    const { store } = memoryStore();
    const run = orchestrator(store, caseFile("en"));
    await analyseLetter(run, letterAgents([], []));

    expect(await run.finish()).toBeNull();
    expect(store.finishRun).toHaveBeenCalledWith(RUN_ID, "DONE");
    expect(store.waitForUser).not.toHaveBeenCalled();
  });

  it("shows at most one question per run, and only questions the page can show", async () => {
    const { store } = memoryStore();
    const run = orchestrator(store, caseFile("en"));
    const deadline = fakeAgent("deadline", async () => ask("RECEIVED_DATE"));
    const writer = fakeAgent("replyWriter", async () => ask("REPLY_NOTES"));

    await run.dispatch(writer, "Write");
    expect(run.pendingQuestion).toBeNull();

    await run.dispatch(deadline, "Compute");
    const first = run.pendingQuestion;
    await run.dispatch(fakeAgent("deadline", async () => ask("FEDERAL_STATE")), "Compute again");
    expect(run.pendingQuestion).toBe(first);
    expect(first?.question).toBe("RECEIVED_DATE");
  });

  it("goes on from the deadline agent after the answer, without extracting or verifying again", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    const file: DocumentCaseFile = {
      ...caseFile("tr"),
      extraction: { ...ANALYSIS },
      answer: { question: "RECEIVED_DATE", value: "2026-09-20" },
    };
    const questionId = "00000000-0000-4000-8000-0000000000aa";
    const run = new Orchestrator(RUN_ID, file, {
      store,
      onProgress: async () => {},
      resume: { hops: 10, ran: ["intake", "extractor", "verifier", "translator"], userQuestions: 1 },
    });

    await run.recordAnswer(questionId, "RECEIVED_DATE", "2026-09-20");
    // The agent asks again: the run already showed its one card, so it ends
    await analyseLetter(run, letterAgents(order, [ask("FEDERAL_STATE")]));

    expect(order).toEqual(["deadline+answer"]);
    expect(messages.map((m) => [m.hop, m.from, m.to, m.payload.kind])).toEqual([
      [10, "user", "orchestrator", "answer"],
      [11, "orchestrator", "deadline", "task"],
      [12, "deadline", "orchestrator", "question"],
    ]);
    // The answer answers the question, the new task answers the answer
    expect(messages[0].parentId).toBe(questionId);
    expect(messages[1].parentId).toBe(messages[0].id);
    for (const message of messages) expect(AgentMessageSchema.parse(message)).toEqual(message);
    expect(await run.finish()).toBeNull();
    expect(store.finishRun).toHaveBeenCalledWith(RUN_ID, "DONE");
  });

  it("makes the translation after the answer when the run had not made it", async () => {
    const order: string[] = [];
    const { store } = memoryStore();
    const file: DocumentCaseFile = { ...caseFile("tr"), answer: { question: "RECEIVED_DATE", value: null } };
    const run = new Orchestrator(RUN_ID, file, {
      store,
      onProgress: async () => {},
      resume: { hops: 8, ran: ["intake", "extractor", "verifier"], userQuestions: 1 },
    });

    await analyseLetter(run, letterAgents(order, []));
    expect(order).toEqual(["deadline+answer", "translator+answer"]);
  });

  it("fits the longest plan with a question and its answer into the message limit", async () => {
    const order: string[] = [];
    const { store, messages } = memoryStore();
    const verifier: AgentReply[] = [{ kind: "revise", target: "extraction", issues: [ISSUE] }];
    const agents = letterAgents(order, [ask("RECEIVED_DATE")]);
    agents.verifier = fakeAgent("verifier", async () => verifier.shift() ?? { kind: "result", wrote: [], summary: "" });
    const run = orchestrator(store, caseFile("tr"));
    await analyseLetter(run, agents);
    expect(messages).toHaveLength(14);

    const waiting = run.pendingQuestion!;
    const file: DocumentCaseFile = { ...caseFile("tr"), answer: { question: "RECEIVED_DATE", value: "2026-09-20" } };
    const resumed = new Orchestrator(RUN_ID, file, {
      store,
      onProgress: async () => {},
      resume: { hops: messages.length, ran: ["intake", "extractor", "verifier", "translator"], userQuestions: 1 },
    });
    await resumed.recordAnswer(waiting.messageId, "RECEIVED_DATE", "2026-09-20");
    await analyseLetter(resumed, agents);
    expect(messages).toHaveLength(MAX_AGENT_HOPS);
  });
});
