import { describe, expect, it } from "vitest";
import type { DeadlineRow } from "../deadlines/deadlineRows";
import { deadlineQuestion } from "./userQuestion";

function row(overrides: Partial<DeadlineRow> = {}): DeadlineRow {
  return {
    documentId: "doc-1",
    kind: "OBJECTION",
    sourceText: "innerhalb eines Monats nach Bekanntgabe",
    dueDate: new Date("2026-10-19T00:00:00Z"),
    isEstimate: false,
    steps: [],
    ...overrides,
  };
}

describe("deadlineQuestion", () => {
  it("asks for the delivery day when a due date is counted from an assumed one", () => {
    expect(deadlineQuestion([row(), row({ isEstimate: true })], {})).toMatchObject({ question: "RECEIVED_DATE" });
  });

  it("does not ask again once the user entered the day", () => {
    expect(deadlineQuestion([row({ isEstimate: true })], { receivedDate: "2026-09-20" })).toBeNull();
  });

  it("asks for the federal state when a due date falls on a regional holiday", () => {
    const regional = row({ steps: [{ type: "REGIONAL_HOLIDAY", date: "2026-10-31", states: ["BB", "SN"] }] });
    expect(deadlineQuestion([regional], {})).toMatchObject({ question: "FEDERAL_STATE" });
    expect(deadlineQuestion([regional], { state: "BY" })).toBeNull();
  });

  it("asks for the delivery day first: one question per run", () => {
    const regional = row({
      isEstimate: true,
      steps: [{ type: "REGIONAL_HOLIDAY", date: "2026-10-31", states: ["BB"] }],
    });
    expect(deadlineQuestion([regional], {})?.question).toBe("RECEIVED_DATE");
  });

  it("asks nothing for fixed dates and letters without deadlines", () => {
    expect(deadlineQuestion([row()], {})).toBeNull();
    expect(deadlineQuestion([], {})).toBeNull();
  });
});
