import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeResult } from "@briefklar/shared";
import { classifyLetter } from "../documents/classifyLetter";
import { LLMError } from "../llm/errors";
import type { DocumentCaseFile } from "./documentCaseFile";
import { intakeAgent } from "./intakeAgent";

vi.mock("../lib/prisma", () => ({ prisma: {} }));
vi.mock("../documents/classifyLetter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../documents/classifyLetter")>()),
  classifyLetter: vi.fn(),
}));

const classify = vi.mocked(classifyLetter);

const INVITATION: IntakeResult = {
  isOfficialLetter: false,
  letterType: "OTHER",
  language: "de",
  scanQuality: "GOOD",
  senderName: "Anna",
  summary: "A private invitation to a birthday party.",
};

function answer(data: IntakeResult) {
  return { data, model: "claude-haiku-5-5", attempts: 1, inputTokens: 900, outputTokens: 60, latencyMs: 800 };
}

function caseFile(): DocumentCaseFile {
  return { documentId: "doc-1", fileKey: "f", mimeType: "text/plain", language: null, file: Buffer.from("Hallo") };
}

async function run(file: DocumentCaseFile) {
  const report = vi.fn(async () => {});
  const reply = await intakeAgent.handle({ kind: "task", instruction: "Classify", notes: [] }, { runId: "r", caseFile: file, report });
  return { reply, report };
}

describe("intakeAgent", () => {
  beforeEach(() => {
    classify.mockReset();
  });

  it("writes a short analysis for a document that is not an official letter", async () => {
    classify.mockResolvedValue(answer(INVITATION));
    const file = caseFile();
    const { reply, report } = await run(file);

    expect(report).toHaveBeenCalledWith("classifying");
    expect(reply).toMatchObject({ kind: "result", wrote: ["intake", "extraction"] });
    expect(file.intake).toMatchObject({ isOfficialLetter: false, model: "claude-haiku-5-5" });
    expect(file.extraction).toMatchObject({
      isOfficialLetter: false,
      summary: INVITATION.summary,
      sender: { name: "Anna", type: "OTHER" },
      deadlines: [],
      requiredActions: [],
      urgency: "LOW",
    });
    expect(file.promptVersion).toMatch(/^classify-letter@/);
  });

  it("leaves the analysis to the extractor for an official letter", async () => {
    classify.mockResolvedValue(answer({ ...INVITATION, isOfficialLetter: true, letterType: "BESCHEID" }));
    const file = caseFile();
    const { reply } = await run(file);

    expect(reply).toMatchObject({ kind: "result", wrote: ["intake"] });
    expect(file.extraction).toBeUndefined();
  });

  it("writes no analysis for an unreadable scan, even if it does not look like a letter", async () => {
    classify.mockResolvedValue(answer({ ...INVITATION, scanQuality: "UNREADABLE" }));
    const file = caseFile();
    await run(file);

    expect(file.intake?.scanQuality).toBe("UNREADABLE");
    expect(file.extraction).toBeUndefined();
  });

  it("lets the run go on as for a letter when the model fails", async () => {
    classify.mockRejectedValue(new LLMError("overloaded", true, "Try again", "AI_OVERLOADED", 503, "claude-haiku-5-5"));
    const file = caseFile();
    const { reply } = await run(file);

    expect(reply).toMatchObject({ kind: "result", wrote: [] });
    expect(file.intake).toBeUndefined();
  });
});
