import { describe, expect, it, vi } from "vitest";
import type { LetterExtraction } from "@briefklar/shared";
import { CHAT_TOOL_NAMES } from "@briefklar/shared";
import { CHAT_TOOLS, runTool, toolDeclarations, type ToolContext } from "./tools";

const extraction: LetterExtraction = {
  isOfficialLetter: true,
  letterLanguage: "de",
  summary: "The Jobcenter reduces your benefit.",
  sender: { name: "Jobcenter Frankfurt", type: "JOBCENTER" },
  letterType: "BESCHEID",
  letterDate: "2026-11-10",
  subject: "Änderungsbescheid",
  references: [{ label: "BG-Nummer", value: "123" }],
  amounts: [],
  deadlines: [
    { rawText: "innerhalb eines Monats nach Bekanntgabe", explicitDate: null, kind: "OBJECTION" },
    { rawText: "unverzüglich", explicitDate: null, kind: "DOCUMENTS" },
  ],
  requiredActions: ["Send the pay slips"],
  requiredDocuments: [],
  objectionPossible: true,
  urgency: "MEDIUM",
  uncertainFields: [],
};

const context = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  userId: "user-1",
  documentId: "doc-1",
  today: "2026-11-18",
  state: "HE",
  extraction,
  receivedDate: null,
  deadlines: [
    {
      dueDate: new Date("2026-12-14T00:00:00Z"),
      kind: "OBJECTION",
      sourceText: "innerhalb eines Monats nach Bekanntgabe",
      isEstimate: true,
      steps: [],
    },
  ],
  actionItems: [{ text: "Send the pay slips", done: false }],
  ...overrides,
});

describe("chat tools", () => {
  it("declare every shared tool name with an object schema", () => {
    const declarations = toolDeclarations();
    expect(declarations.map((d) => d.name).sort()).toEqual([...CHAT_TOOL_NAMES].sort());
    for (const declaration of declarations) {
      expect(declaration.parameters).toMatchObject({ type: "object" });
      expect(declaration.parameters).not.toHaveProperty("$schema");
    }
    expect(CHAT_TOOLS).toHaveLength(CHAT_TOOL_NAMES.length);
  });

  it("get_letter_details returns calculated deadlines and those without a date", async () => {
    const { ok, result } = await runTool("get_letter_details", {}, context());
    expect(ok).toBe(true);
    expect(result).toMatchObject({
      sender: "Jobcenter Frankfurt",
      receivedDate: "not entered by the user",
      deadlines: [{ kind: "OBJECTION", dueDate: "2026-12-14", weekday: "Monday", isEstimate: true }],
      deadlinesWithoutDate: [{ kind: "DOCUMENTS", wordingInLetter: "unverzüglich" }],
    });
  });

  it("calculate_deadline uses the deadline engine, with the letter's date and sender", async () => {
    // 10.11. + 4 days = 14.11. (Saturday) -> Monday 16.11.; + 1 month = 16.12.
    const { result } = await runTool("calculate_deadline", { wording: "innerhalb eines Monats nach Bekanntgabe" }, context());
    expect(result).toMatchObject({ dueDate: "2026-12-16", weekday: "Wednesday", isEstimate: true });
  });

  it("calculate_deadline answers 'what if it arrived on ...'", async () => {
    const { result } = await runTool(
      "calculate_deadline",
      { wording: "binnen zwei Wochen nach Zugang", receivedDate: "2026-12-10" },
      context(),
    );
    // 10.12. + 2 weeks = 24.12. (a working day; Christmas Eve is not a public holiday)
    expect(result).toMatchObject({ dueDate: "2026-12-24", isEstimate: false });
  });

  it("calculate_deadline takes a written date as it is and reports wording it cannot handle", async () => {
    expect((await runTool("calculate_deadline", { wording: "bis zum 05.01.2027" }, context())).result).toMatchObject({
      dueDate: "2027-01-05",
    });
    const unclear = await runTool("calculate_deadline", { wording: "drei Werktage vor dem Termin" }, context());
    expect(unclear.ok).toBe(false);
  });

  it("check_date knows the user's regional holidays", async () => {
    const { result } = await runTool("check_date", { date: "2027-05-27" }, context()); // Corpus Christi
    expect(result).toMatchObject({
      isWorkingDay: false,
      publicHoliday: { id: "CORPUS_CHRISTI", germanName: "Fronleichnam" },
      nextWorkingDay: "2027-05-28",
    });
  });

  it("check_date names the states with a regional holiday when the user's state is unknown", async () => {
    const { result } = await runTool("check_date", { date: "2026-11-18" }, context({ state: null }));
    expect(result).toMatchObject({ isWorkingDay: true, regionalHolidayIn: ["SN"] }); // Buß- und Bettag
  });

  it("list_public_holidays lists a year's holidays in date order", async () => {
    const { result } = await runTool("list_public_holidays", { year: 2027 }, context());
    const holidays = result.holidays as { date: string }[];
    expect(holidays[0]).toMatchObject({ date: "2027-01-01", id: "NEW_YEAR", germanName: "Neujahr" });
    expect(holidays.map((h) => h.date)).toEqual(holidays.map((h) => h.date).sort());
  });

  it("create_reminder counts days back in code and refuses dates in the past", async () => {
    const { ok, result } = await runTool(
      "create_reminder",
      { date: "2026-11-19", daysBefore: 2, note: "Widerspruch abschicken" },
      context(),
    );
    expect(ok).toBe(false);
    expect(result.error).toMatch(/past.*2026-11-18/);
  });

  it("rejects invalid arguments with a message for the model", async () => {
    const { ok, result } = await runTool("list_public_holidays", { year: "next" }, context());
    expect(ok).toBe(false);
    expect(result.error).toMatch(/^Invalid arguments/);
  });

  it("delegate hands a reply to the orchestrator and passes its activity on", async () => {
    const onAgent = vi.fn();
    const delegate = vi.fn<NonNullable<ToolContext["delegate"]>>(async (_request, report) => {
      report("replyWriter", "started");
      return { ok: true, result: { status: "draft_saved" }, replyDraft: { id: "draft-1", type: "OBJECTION" } };
    });
    const input = { agent: "replyWriter", input: { type: "OBJECTION", notes: "Ich war krank" } };

    const output = await runTool("delegate", input, context({ delegate, onAgent }));
    expect(output.replyDraft).toEqual({ id: "draft-1", type: "OBJECTION" });
    expect(delegate).toHaveBeenCalledWith(input, onAgent);
    expect(onAgent).toHaveBeenCalledWith("replyWriter", "started");
  });

  it("delegate refuses unknown agents, letters that are no official letter and chats without it", async () => {
    const delegate = vi.fn();
    const input = { agent: "replyWriter", input: { type: "OBJECTION", notes: "" } };
    expect((await runTool("delegate", { ...input, agent: "extractor" }, context({ delegate }))).ok).toBe(false);
    const privateLetter = context({ delegate, extraction: { ...extraction, isOfficialLetter: false } });
    expect((await runTool("delegate", input, privateLetter)).ok).toBe(false);
    expect((await runTool("delegate", input, context())).ok).toBe(false);
    expect(delegate).not.toHaveBeenCalled();
  });
});
