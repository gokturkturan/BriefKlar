import { describe, expect, it } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import { deadlineRows } from "./deadlineRows";

const extraction: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "",
  sender: { name: "Jobcenter Köln", type: "JOBCENTER" },
  letterType: "BESCHEID",
  letterDate: "2026-04-28",
  subject: "Bewilligungsbescheid",
  references: [],
  amounts: [],
  deadlines: [
    { rawText: "innerhalb eines Monats nach Bekanntgabe", explicitDate: null, kind: "OBJECTION" },
    { rawText: "bis zum 15.05.2026", explicitDate: "2026-05-15", kind: "DOCUMENTS" },
  ],
  requiredActions: [],
  requiredDocuments: [],
  objectionPossible: true,
  urgency: "MEDIUM",
  uncertainFields: [],
};

const objection = (rows: ReturnType<typeof deadlineRows>) => rows.find((r) => r.kind === "OBJECTION")!;
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe("deadlineRows", () => {
  it("assumes delivery on the 4th day without further information", () => {
    // 28 April + 4 days = 2 May (Saturday) -> Monday 4 May; + 1 month = Thursday 4 June
    const row = objection(deadlineRows("doc", extraction));
    expect(iso(row.dueDate)).toBe("2026-06-04");
    expect(row.isEstimate).toBe(true);
  });

  it("uses the delivery date the user entered instead of the assumption", () => {
    const row = objection(deadlineRows("doc", extraction, { receivedDate: "2026-04-30" }));
    expect(iso(row.dueDate)).toBe("2026-06-01"); // 30 May is a Saturday
    expect(row.isEstimate).toBe(false);
    expect(row.steps[0]).toEqual({ type: "RECEIVED_ON", date: "2026-04-30" });
  });

  it("applies the regional holidays of the user's state", () => {
    // Fronleichnam (Corpus Christi) is on 4 June 2026 in NRW, but not in Berlin
    const nrw = objection(deadlineRows("doc", extraction, { state: "NW" }));
    const berlin = objection(deadlineRows("doc", extraction, { state: "BE" }));
    expect(iso(nrw.dueDate)).toBe("2026-06-05");
    expect(iso(berlin.dueDate)).toBe("2026-06-04");
    expect(berlin.steps.map((step) => step.type)).not.toContain("REGIONAL_HOLIDAY");
  });

  it("notes regional holidays when the state is unknown", () => {
    const row = objection(deadlineRows("doc", extraction));
    expect(row.steps.at(-1)).toMatchObject({ type: "REGIONAL_HOLIDAY", date: "2026-06-04" });
  });

  it("keeps explicit dates as written, whatever the context", () => {
    const rows = deadlineRows("doc", extraction, { receivedDate: "2026-05-02", state: "BY" });
    const documents = rows.find((r) => r.kind === "DOCUMENTS")!;
    expect(iso(documents.dueDate)).toBe("2026-05-15");
    expect(documents.isEstimate).toBe(false);
    expect(documents.steps).toEqual([]);
  });
});
