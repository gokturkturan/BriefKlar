import { describe, expect, it, vi } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import { markUncertain, topLevelField } from "../documents/verifyExtraction";
import { LLMError } from "../llm/errors";
import type { JsonGenerationRequest, LLMProvider } from "../llm/LLMProvider";
import type { DocumentCaseFile } from "./documentCaseFile";
import { createVerifierAgent } from "./verifierAgent";

vi.mock("../lib/prisma", () => ({ prisma: {} }));
vi.mock("../llm/logCall", () => ({
  loggedCall: (_context: unknown, request: () => Promise<unknown>) => request(),
}));

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
  uncertainFields: ["deadlines"],
};

/** A provider that answers every JSON request with `answer` and keeps the requests */
function fakeProvider(answer: () => Promise<string>) {
  const requests: JsonGenerationRequest[] = [];
  const provider = {
    name: "openai",
    model: "gpt-6-luna",
    generateJson: async (request: JsonGenerationRequest) => {
      requests.push(request);
      return { text: await answer(), model: "gpt-6-luna", inputTokens: 1, outputTokens: 1, latencyMs: 1, failedAttempts: [] };
    },
  } as unknown as LLMProvider;
  return { provider, requests };
}

function caseFile(): DocumentCaseFile {
  return {
    documentId: "doc-1",
    fileKey: "file-1",
    mimeType: "text/plain",
    language: null,
    file: Buffer.from("Bitte zahlen Sie 1.240,00 € bis zum 19.10.2026."),
    extraction: ANALYSIS,
  };
}

const context = (file: DocumentCaseFile) => ({ runId: "run-1", caseFile: file, report: vi.fn(async () => {}) });
const task = { kind: "task" as const, instruction: "Check", notes: [] };

describe("verifier agent", () => {
  it("sends the letter and the analysis, and asks for a correction with the issues it found", async () => {
    const issue = { field: "amounts[0].value", problem: "The letter says 1240", evidence: "Bitte zahlen Sie 1.240,00 €" };
    const { provider, requests } = fakeProvider(async () => JSON.stringify({ issues: [issue] }));
    const file = caseFile();

    const reply = await createVerifierAgent(provider).handle(task, context(file));

    expect(reply).toEqual({ kind: "revise", target: "extraction", issues: [issue] });
    expect(file.verdict).toEqual({ issues: [issue], model: "gpt-6-luna" });
    expect(requests[0].input[0]).toMatchObject({ type: "file", mimeType: "text/plain" });
    expect(requests[0].input[1]).toMatchObject({ type: "text", text: expect.stringContaining('"value": 124') });
  });

  it("approves an analysis without issues", async () => {
    const { provider } = fakeProvider(async () => JSON.stringify({ issues: [] }));
    const reply = await createVerifierAgent(provider).handle(task, context(caseFile()));
    expect(reply).toMatchObject({ kind: "result", wrote: ["verdict"] });
  });

  it("cuts evidence to the length a message allows", async () => {
    const long = "x".repeat(500);
    const { provider } = fakeProvider(async () =>
      JSON.stringify({ issues: [{ field: "summary", problem: "Invented", evidence: long }] }),
    );
    const reply = await createVerifierAgent(provider).handle(task, context(caseFile()));
    expect(reply.kind === "revise" && reply.issues[0].evidence).toHaveLength(300);
  });

  it("keeps the analysis when its model fails", async () => {
    const { provider } = fakeProvider(() =>
      Promise.reject(new LLMError("down", true, "Try again", "AI_OVERLOADED", 503, "gpt-6-luna")),
    );
    const reply = await createVerifierAgent(provider).handle(task, context(caseFile()));
    expect(reply).toMatchObject({ kind: "result", wrote: [], summary: expect.stringContaining("skipped") });
  });

  it("does nothing without a configured verifier", async () => {
    const reply = await createVerifierAgent(undefined).handle(task, context(caseFile()));
    expect(reply).toMatchObject({ kind: "result", wrote: [] });
  });
});

describe("markUncertain", () => {
  it("adds the top-level fields of the issues once, keeping the earlier ones", () => {
    const issues = [
      { field: "amounts[0].value", problem: "p", evidence: "e" },
      { field: "amounts", problem: "p", evidence: "e" },
      { field: "letterDate", problem: "p", evidence: "e" },
    ];
    expect(markUncertain(ANALYSIS, issues).uncertainFields).toEqual(["deadlines", "amounts", "letterDate"]);
    expect(topLevelField("deadlines[1].explicitDate")).toBe("deadlines");
    expect(topLevelField("sender.type")).toBe("sender");
  });
});
