import { describe, expect, it, vi } from "vitest";
import type { AgentPayload } from "@briefklar/shared";
import { readWaitingRun } from "./resumeRun";

vi.mock("../lib/prisma", () => ({ prisma: {} }));

let hop = 0;
function message(from: string, payload: AgentPayload) {
  hop += 1;
  return { id: `m${hop}`, from, kind: payload.kind, payload, hop };
}
const task = (to: string) => message("orchestrator", { kind: "task", instruction: `to ${to}`, notes: [] });
const result = (from: string) => message(from, { kind: "result", wrote: [], summary: "" });

describe("readWaitingRun", () => {
  it("finds the question and the agents the resumed plan leaves out", () => {
    hop = 0;
    const messages = [
      task("intake"),
      result("intake"),
      task("extractor"),
      result("extractor"),
      task("verifier"),
      message("verifier", { kind: "error", code: "AI_OVERLOADED", message: "busy", retryable: true }),
      task("deadline"),
      message("deadline", { kind: "question", askUser: true, question: "RECEIVED_DATE", text: "When?" }),
      task("translator"),
      result("translator"),
    ];

    expect(readWaitingRun("run-1", 10, messages)).toEqual({
      runId: "run-1",
      messageId: "m8",
      agent: "deadline",
      question: "RECEIVED_DATE",
      hops: 10,
      // The verifier failed, the deadline agent asked: neither counts as done
      ran: ["intake", "extractor", "translator"],
      userQuestions: 1,
    });
  });

  it("finds nothing when no agent asked the user", () => {
    hop = 0;
    const messages = [
      task("replyWriter"),
      message("replyWriter", { kind: "question", askUser: false, question: "REPLY_NOTES", text: "Notes?" }),
    ];
    expect(readWaitingRun("run-1", 2, messages)).toBeNull();
  });
});
