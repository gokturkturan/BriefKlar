import { describe, expect, it, vi } from "vitest";
import {
  AgentMessageSchema,
  CHAT_QUESTIONS,
  MAX_AGENT_HOPS,
  type AgentIssue,
  type AgentMessage,
  type AgentPhase,
  type LetterExtraction,
} from "@briefklar/shared";
import { LLMError } from "../llm/errors";
import type { JsonGenerationRequest, LLMProvider } from "../llm/LLMProvider";
import { UNSUPPORTED_PLACEHOLDER } from "../replies/replyFacts";
import type { AgentStore } from "./agentStore";
import { Orchestrator } from "./orchestrator";
import type { ReplyCaseFile } from "./replyCaseFile";
import { createReplyVerifierAgent } from "./replyVerifierAgent";
import { createReplyWriterAgent } from "./replyWriterAgent";
import { createResearchAgent } from "./researchAgent";
import { readWaitingReplyRun, writeReply, type ReplyAgents } from "./writeReply";
import type { Agent, AgentReply } from "./types";

vi.mock("../lib/prisma", () => ({ prisma: {} }));
vi.mock("../llm/logCall", () => ({
  loggedCall: (_context: unknown, request: () => Promise<unknown>) => request(),
}));

const RUN_ID = "00000000-0000-4000-8000-000000000002";

const ANALYSIS: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "The Beitragsservice reminds you of 220.32 EUR.",
  sender: { name: "ARD ZDF Deutschlandradio Beitragsservice", type: "RUNDFUNKBEITRAG" },
  letterType: "MAHNUNG",
  letterDate: "2026-10-01",
  subject: "Zahlungserinnerung",
  references: [{ label: "Beitragsnummer", value: "123 456 789" }],
  amounts: [{ value: 220.32, currency: "EUR", purpose: "Rückstand" }],
  deadlines: [],
  requiredActions: [],
  requiredDocuments: [],
  objectionPossible: false,
  urgency: "MEDIUM",
  uncertainFields: [],
};

function memoryStore(llmCalls = () => 0) {
  const messages: AgentMessage[] = [];
  const store: AgentStore = {
    startRun: async () => ({ id: RUN_ID }),
    recordMessage: async (message) => {
      messages.push(message);
    },
    llmCallCount: async () => llmCalls(),
    finishRun: vi.fn(async () => {}),
    waitForUser: vi.fn(async () => {}),
    resumeRun: vi.fn(async () => true),
  };
  return { store, messages };
}

function caseFile(notes = "", mayAsk = true): ReplyCaseFile {
  return {
    documentId: "doc-1",
    type: "INSTALLMENT_PLAN",
    notes,
    language: "tr",
    extraction: ANALYSIS,
    today: "2026-11-19",
    mayAsk,
  };
}

/** A provider whose JSON answers come from a script, one per request */
function scriptedProvider(answers: (string | Error)[]) {
  const requests: JsonGenerationRequest[] = [];
  const provider = {
    name: "fake",
    model: "fake-model",
    generateJson: async (request: JsonGenerationRequest) => {
      requests.push(request);
      const answer = answers.shift();
      if (answer instanceof Error || answer === undefined) throw answer ?? new Error("no more answers");
      return { text: answer, model: "fake-model", inputTokens: 1, outputTokens: 1, latencyMs: 1, failedAttempts: [] };
    },
  } as unknown as LLMProvider;
  return { provider, requests };
}

const draft = (paragraphs: string[]) =>
  JSON.stringify({ subject: "Antrag auf Ratenzahlung", paragraphs, translation: "Taksit talebi" });
const noIssues = JSON.stringify({ issues: [] });

function agents(writerAnswers: (string | Error)[], verifierAnswers: (string | Error)[], sources = true) {
  const writer = scriptedProvider(writerAnswers);
  const verifier = scriptedProvider(verifierAnswers);
  const search = vi.fn(async () =>
    sources
      ? [{ slug: "raten", title: "Ratenzahlung", content: "", sourceUrl: "https://example.org/raten", similarity: 0.8 }]
      : [],
  );
  const set: ReplyAgents = {
    replyWriter: createReplyWriterAgent(writer.provider),
    verifier: createReplyVerifierAgent(verifier.provider),
    research: createResearchAgent(search),
  };
  return { set, writer, verifier, search };
}

describe("writeReply", () => {
  it("asks the user once for what only they know and waits, without a model request", async () => {
    const { store, messages } = memoryStore();
    const file = caseFile("Ich habe meine Arbeit verloren");
    const run = new Orchestrator(RUN_ID, file, { store, onProgress: async () => {}, askable: CHAT_QUESTIONS });
    const { set, writer } = agents([], []);

    await run.handoff("chat", "replyWriter", "The user asked for a draft", { type: "INSTALLMENT_PLAN" });
    expect(await writeReply(run, set)).toBe("question");

    expect(writer.requests).toHaveLength(0);
    expect(file.missing).toEqual(["monthlyAmount"]);
    expect(run.pendingQuestion?.question).toBe("REPLY_NOTES");
    expect(messages.map((m) => [m.from, m.to, m.payload.kind])).toEqual([
      ["chat", "replyWriter", "handoff"],
      ["orchestrator", "replyWriter", "task"],
      ["replyWriter", "orchestrator", "question"],
    ]);
    // The task answers the handoff
    expect(messages[1].parentId).toBe(messages[0].id);
    expect(await run.finish()).toBe("REPLY_NOTES");
    expect(store.waitForUser).toHaveBeenCalledWith(RUN_ID);
  });

  it("writes with placeholders when the run may not ask (the reply panel)", async () => {
    const { store } = memoryStore();
    const file = caseFile("", false);
    const run = new Orchestrator(RUN_ID, file, { store, onProgress: async () => {}, askable: [] });
    const { set } = agents([draft(["Ich bitte um Ratenzahlung von [monatlicher Betrag]."])], [noIssues]);

    expect(await writeReply(run, set, { research: false })).toBe("draft");
    expect(file.body?.paragraphs).toEqual(["Ich bitte um Ratenzahlung von [monatlicher Betrag]."]);
    expect(file.verdict?.issues).toEqual([]);
  });

  it("goes on after the answer: draft, check, one correction, second check and sources", async () => {
    const { store, messages } = memoryStore();
    const file = caseFile("50 Euro im Monat", false);
    const run = new Orchestrator(RUN_ID, file, {
      store,
      onProgress: async () => {},
      askable: CHAT_QUESTIONS,
      resume: { hops: 3, ran: [], userQuestions: 1 },
    });
    const invented: AgentIssue = {
      field: "paragraphs[1]",
      problem: "The job loss is not in the notes",
      evidence: "Ich bin arbeitslos.",
    };
    const { set, writer } = agents(
      [
        draft(["Ich bitte um Raten von 50 € für 220,32 €.", "Ich bin arbeitslos seit dem 01.09.2026."]),
        draft(["Ich bitte um Raten von 50 € für 220,32 €."]),
      ],
      [JSON.stringify({ issues: [invented] }), noIssues],
    );

    await run.recordAnswer("00000000-0000-4000-8000-0000000000aa", "REPLY_NOTES", "50 Euro im Monat");
    expect(await writeReply(run, set)).toBe("draft");

    expect(messages.map((m) => [m.from, m.payload.kind])).toEqual([
      ["user", "answer"],
      ["orchestrator", "task"],
      ["replyWriter", "result"],
      ["orchestrator", "task"],
      ["verifier", "revise"],
      ["orchestrator", "task"],
      ["replyWriter", "result"],
      ["orchestrator", "task"],
      ["verifier", "result"],
      ["orchestrator", "task"],
      ["research", "result"],
    ]);
    // The correction gets both the code's issue (the date) and the model's (the job loss)
    const revise = messages[4].payload;
    expect(revise.kind === "revise" && revise.issues.map((i) => i.field)).toEqual(["paragraphs[1]", "paragraphs[1]"]);
    expect(writer.requests[1]?.input.at(-1)).toMatchObject({ type: "text" });
    expect(JSON.stringify(writer.requests[1]?.input)).toContain("01.09.2026");
    expect(file.body?.paragraphs).toEqual(["Ich bitte um Raten von 50 € für 220,32 €."]);
    expect(file.sources).toEqual([{ title: "Ratenzahlung", url: "https://example.org/raten" }]);
    expect(messages.at(-1)!.hop + 1).toBeLessThanOrEqual(MAX_AGENT_HOPS);
    for (const message of messages) expect(AgentMessageSchema.parse(message)).toEqual(message);
  });

  it("turns numbers still unsupported after the correction into placeholders", async () => {
    const { store } = memoryStore();
    const file = caseFile("50 Euro im Monat", false);
    const run = new Orchestrator(RUN_ID, file, { store, onProgress: async () => {}, askable: [] });
    const made = draft(["Ich zahle 50 € ab dem 01.12.2026."]);
    // The model check fails both times: the code's check stands
    const { set } = agents(
      [made, made],
      [new LLMError("down", true, "down", "AI_OVERLOADED"), new LLMError("down", true, "down", "AI_OVERLOADED")],
    );

    expect(await writeReply(run, set, { research: false })).toBe("draft");
    expect(file.verdict?.issues).toHaveLength(1);
    expect(file.replaced).toEqual(["01.12.2026"]);
    expect(file.body?.paragraphs).toEqual([`Ich zahle 50 € ab dem ${UNSUPPORTED_PLACEHOLDER}.`]);
  });

  it("leaves the correction out when the run cannot afford it", async () => {
    const { set, writer, verifier } = agents([draft(["Ich zahle 70 €."])], [noIssues]);
    // Four requests were made before (e.g. in the chat run's first part)
    const { store, messages } = memoryStore(() => 4 + writer.requests.length + verifier.requests.length);
    const file = caseFile("50 Euro im Monat", false);
    const run = new Orchestrator(RUN_ID, file, { store, onProgress: async () => {}, askable: [] });

    await writeReply(run, set);
    // Draft and check are the run's fifth and sixth request; the correction and the research would exceed it
    expect(messages.filter((m) => m.payload.kind === "task").map((m) => m.to)).toEqual(["replyWriter", "verifier"]);
    expect(file.body?.paragraphs).toEqual([`Ich zahle ${UNSUPPORTED_PLACEHOLDER} €.`]);
  });

  it("tells the caller when each agent starts and how it ended", async () => {
    const { store } = memoryStore();
    const events: [string, AgentPhase][] = [];
    const run = new Orchestrator(RUN_ID, caseFile("50 Euro", false), {
      store,
      onProgress: async () => {},
      onAgent: (agent, phase) => events.push([agent, phase]),
    });
    const { set } = agents([draft(["Ich zahle 50 €."])], [noIssues], false);

    await writeReply(run, set);
    expect(events).toEqual([
      ["replyWriter", "started"],
      ["replyWriter", "done"],
      ["verifier", "started"],
      ["verifier", "done"],
      ["research", "started"],
      ["research", "done"],
    ]);
  });
});

describe("readWaitingReplyRun", () => {
  it("finds the reply writer's question and the type of the handoff", () => {
    const messages = [
      {
        id: "m0",
        from: "chat",
        hop: 0,
        payload: { kind: "handoff", reason: "draft", input: { type: "OBJECTION", notes: "" } },
      },
      { id: "m1", from: "orchestrator", hop: 1, payload: { kind: "task", instruction: "Write", notes: [] } },
      {
        id: "m2",
        from: "replyWriter",
        hop: 2,
        payload: { kind: "question", askUser: true, question: "REPLY_NOTES", text: "Why?" },
      },
    ];
    expect(readWaitingReplyRun("run-1", 3, messages)).toEqual({
      runId: "run-1",
      messageId: "m2",
      agent: "replyWriter",
      question: "REPLY_NOTES",
      text: "Why?",
      hops: 3,
      ran: [],
      userQuestions: 1,
      type: "OBJECTION",
      notes: "",
    });
  });
});

describe("Orchestrator.handoff", () => {
  it("records a valid handoff message and stays within the message limit", async () => {
    const { store, messages } = memoryStore();
    const run = new Orchestrator(RUN_ID, caseFile(), { store, onProgress: async () => {}, maxHops: 1 });
    const id = await run.handoff("chat", "replyWriter", "draft", { type: "OBJECTION" });
    expect(run.lastReplyId).toBe(id);
    expect(AgentMessageSchema.parse(messages[0])).toEqual(messages[0]);
    await expect(run.handoff("chat", "replyWriter", "again", {})).rejects.toThrow("would exceed");
  });

  it("does not let a question the run cannot ask reach the user", async () => {
    const { store } = memoryStore();
    const run = new Orchestrator(RUN_ID, caseFile(), { store, onProgress: async () => {} });
    const asking: Agent<ReplyCaseFile> = {
      name: "replyWriter",
      handle: async (): Promise<AgentReply> => ({
        kind: "question",
        askUser: true,
        question: "REPLY_NOTES",
        text: "?",
      }),
    };
    await run.dispatch(asking, "Write");
    expect(run.pendingQuestion).toBeNull();
  });
});
