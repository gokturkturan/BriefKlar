import {
  DELEGATE_AGENTS,
  HOLIDAY_GERMAN_NAMES,
  parseDeadlineSteps,
  REMINDER_NOTE_MAX_LENGTH,
  REPLY_TYPES,
  type AgentName,
  type AgentPhase,
  type ChatReplyDraftDto,
  type ChatSourceDto,
  type ChatToolName,
  type DelegateAgent,
  type GermanState,
  type LetterExtraction,
} from "@briefklar/shared";
import type { Deadline } from "@prisma/client";
import { z } from "zod";
import { computeRelativeDeadline } from "../deadlines/computeDeadline";
import { addDays, isIsoDate, toIsoDate, weekday, type IsoDate } from "../deadlines/calendarDate";
import { GERMAN_STATES, holidayOn, isWorkingDay, nextWorkingDay, publicHolidays } from "../deadlines/holidays";
import { searchKnowledge } from "../knowledge/knowledgeBase";
import { HttpError } from "../lib/httpError";
import { resolveExplicitDate } from "../lib/germanDates";
import type { ToolDeclaration } from "../llm/LLMProvider";
import { createReminder, listReminders } from "../reminders/reminders";

/**
 * Tools the chat model can call. Each one runs here in the API with checked code and data:
 * the model decides which tool to call with which arguments, and words the answer, but dates,
 * holidays and rules come from the tools, never from the model's memory.
 */

/** Everything a tool may need about the letter and the user */
export interface ToolContext {
  userId: string;
  documentId: string;
  today: IsoDate;
  state: GermanState | null;
  extraction: LetterExtraction;
  receivedDate: IsoDate | null;
  deadlines: Pick<Deadline, "dueDate" | "kind" | "sourceText" | "isEstimate" | "steps">[];
  actionItems: { text: string; done: boolean }[];
  signal?: AbortSignal;
  /**
   * Hands work to another agent through the orchestrator (chatRoutes builds it); without it the
   * delegate tool is not available
   */
  delegate?: (request: DelegateRequest, onAgent: (agent: AgentName, phase: AgentPhase) => void) => Promise<ToolOutput>;
  /** Set by runChat: passes the other agents' activity on to the browser */
  onAgent?: (agent: AgentName, phase: AgentPhase) => void;
}

/** What the chat asks another agent to do */
export interface DelegateRequest {
  agent: DelegateAgent;
  input: { type: (typeof REPLY_TYPES)[number]; notes: string };
}

export interface ToolOutput {
  /** Sent back to the model as the function response */
  result: Record<string, unknown>;
  /** false if the tool could not do what was asked */
  ok: boolean;
  /** Knowledge base entries the answer can be based on */
  sources?: ChatSourceDto[];
  /** A reply draft the tool stored; the page links to it under the answer */
  replyDraft?: ChatReplyDraftDto;
}

export interface ChatTool<A> {
  name: ChatToolName;
  description: string;
  schema: z.ZodType<A>;
  run(args: A, context: ToolContext): Promise<ToolOutput>;
}

const defineTool = <A>(tool: ChatTool<A>) => tool;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayName = (date: IsoDate) => WEEKDAYS[weekday(date)];

/** A result counts as a source of the answer if it is at most this much less similar than the best one */
const SOURCE_SIMILARITY_MARGIN = 0.05;

const isoDate = z.string().describe("A date as YYYY-MM-DD");
const failure = (error: string): ToolOutput => ({ ok: false, result: { error } });

function holidayInfo(date: IsoDate, state: GermanState | null) {
  const holiday = holidayOn(date, state ?? undefined);
  return holiday ? { id: holiday, germanName: HOLIDAY_GERMAN_NAMES[holiday] } : null;
}

const stateNote = (state: GermanState | null) =>
  state ?? "unknown: only nationwide public holidays are applied (the user can set the state in the settings)";

const getLetterDetails = defineTool({
  name: "get_letter_details",
  description:
    "Returns the analysis of the letter the user is asking about: sender, type, date, subject, summary, " +
    "reference numbers, amounts, required actions (with done status), documents to send, whether an objection " +
    "is possible, the day the user received it, and every deadline with the due date already calculated by " +
    "the deadline engine. Call it before answering anything about this letter.",
  schema: z.object({}),
  async run(_args, ctx) {
    const { extraction: e } = ctx;
    const dated = new Set(ctx.deadlines.map((d) => d.sourceText));
    return {
      ok: true,
      result: {
        sender: e.sender.name,
        senderType: e.sender.type,
        letterType: e.letterType,
        letterDate: e.letterDate,
        subject: e.subject,
        summary: e.summary,
        references: e.references,
        amounts: e.amounts,
        requiredActions: ctx.actionItems,
        requiredDocuments: e.requiredDocuments,
        objectionPossible: e.objectionPossible,
        receivedDate: ctx.receivedDate ?? "not entered by the user",
        userFederalState: stateNote(ctx.state),
        deadlines: ctx.deadlines.map((d) => {
          const dueDate = toIsoDate(d.dueDate);
          return {
            kind: d.kind,
            wordingInLetter: d.sourceText,
            dueDate,
            weekday: weekdayName(dueDate),
            isEstimate: d.isEstimate,
            calculationSteps: parseDeadlineSteps(d.steps),
          };
        }),
        deadlinesWithoutDate: e.deadlines
          .filter((d) => !dated.has(d.rawText))
          .map((d) => ({ kind: d.kind, wordingInLetter: d.rawText })),
        today: ctx.today,
      },
    };
  },
});

const searchKnowledgeBase = defineTool({
  name: "search_knowledge_base",
  description:
    "Searches BriefKlar's curated knowledge base on German official letters: objections (Widerspruch, " +
    "Einspruch), delivery and deadlines, payment orders (Mahnbescheid), asking for more time or instalments, " +
    "benefits, residence permits, dismissals, tenancies and where to get advice. Each result has an official " +
    "source. Use it for every question about rules, rights or procedures. Write the query as a short question " +
    "in English or German.",
  schema: z.object({ query: z.string().min(3).max(300).describe("What to look up, e.g. 'deadline for Einspruch'") }),
  async run({ query }, ctx) {
    const hits = await searchKnowledge(query, { documentId: ctx.documentId, signal: ctx.signal });
    if (hits.length === 0) {
      return {
        ok: true,
        result: { results: [], note: "Nothing in the knowledge base matches. Do not answer from memory." },
      };
    }
    return {
      ok: true,
      result: {
        results: hits.map((hit) => ({
          title: hit.title,
          content: hit.content,
          source: hit.sourceUrl,
          similarity: Math.round(hit.similarity * 100) / 100,
        })),
      },
      // Shown under the answer: the best match and those almost as close, not every weak hit
      sources: hits
        .filter((hit) => hit.similarity >= hits[0]!.similarity - SOURCE_SIMILARITY_MARGIN)
        .slice(0, 3)
        .map((hit) => ({ title: hit.title, url: hit.sourceUrl })),
    };
  },
});

const calculateDeadline = defineTool({
  name: "calculate_deadline",
  description:
    "Calculates a due date with BriefKlar's tested deadline engine: delivery rule for letters from authorities, " +
    "§§ 187, 188 BGB and moving to the next working day for weekends and public holidays of the user's state " +
    "(§ 193 BGB). Pass German deadline wording such as 'innerhalb eines Monats nach Bekanntgabe' or " +
    "'binnen zwei Wochen nach Zustellung'. Uses this letter's date and sender. Pass receivedDate to answer " +
    "'what if the letter arrived on ...'. Never calculate a due date yourself.",
  schema: z.object({
    wording: z.string().min(3).max(300).describe("German deadline wording"),
    receivedDate: isoDate.optional().describe("Day the letter arrived, if different from the stored one"),
  }),
  async run({ wording, receivedDate }, ctx) {
    if (receivedDate && !isIsoDate(receivedDate)) return failure(`Invalid date: ${receivedDate}`);

    const explicit = resolveExplicitDate(wording, null);
    if (explicit) {
      return {
        ok: true,
        result: { dueDate: explicit, weekday: weekdayName(explicit), note: "The wording contains this date." },
      };
    }

    const result = computeRelativeDeadline({
      rawText: wording,
      letterDate: ctx.extraction.letterDate,
      senderType: ctx.extraction.sender.type,
      receivedDate: receivedDate ?? ctx.receivedDate,
      state: ctx.state ?? undefined,
    });
    if (!result.ok) return { ok: false, result: { error: `No date can be calculated: ${result.reason}` } };
    return {
      ok: true,
      result: {
        dueDate: result.dueDate,
        weekday: weekdayName(result.dueDate),
        isEstimate: result.isEstimate,
        period: result.period,
        calculationSteps: result.steps,
        userFederalState: stateNote(ctx.state),
      },
    };
  },
});

const checkDate = defineTool({
  name: "check_date",
  description:
    "Checks a date in the German holiday calendar: weekday, whether it is a working day in the user's federal " +
    "state, which public holiday it is, and the next working day.",
  schema: z.object({ date: isoDate }),
  async run({ date }, ctx) {
    if (!isIsoDate(date)) return failure(`Invalid date: ${date}`);
    const state = ctx.state ?? undefined;
    const regional = ctx.state ? [] : GERMAN_STATES.filter((s) => holidayOn(date, s) && !holidayOn(date));
    return {
      ok: true,
      result: {
        date,
        weekday: weekdayName(date),
        isWorkingDay: isWorkingDay(date, state),
        publicHoliday: holidayInfo(date, ctx.state),
        nextWorkingDay: nextWorkingDay(date, state),
        userFederalState: stateNote(ctx.state),
        ...(regional.length > 0 ? { regionalHolidayIn: regional } : {}),
      },
    };
  },
});

const listPublicHolidays = defineTool({
  name: "list_public_holidays",
  description: "Lists the public holidays of a year in the user's federal state (nationwide ones if it is unknown).",
  schema: z.object({ year: z.number().int().min(2000).max(2100) }),
  async run({ year }, ctx) {
    const holidays = [...publicHolidays(year, ctx.state ?? undefined)]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, id]) => ({ date, weekday: weekdayName(date), id, germanName: HOLIDAY_GERMAN_NAMES[id] }));
    return { ok: true, result: { year, userFederalState: stateNote(ctx.state), holidays } };
  },
});

const listRemindersTool = defineTool({
  name: "list_reminders",
  description:
    "Lists the open reminders for this letter: automatic ones for each deadline (3 days before the due date) " +
    "and ones the user set.",
  schema: z.object({}),
  async run(_args, ctx) {
    const { due, upcoming } = await listReminders(ctx.userId, ctx.documentId);
    const describe = (r: (typeof due)[number]) => ({
      remindOn: r.remindOn,
      ...(r.origin === "DEADLINE" ? { forDeadline: r.deadlineKind, dueDate: r.dueDate } : { note: r.note }),
      alreadyDue: r.due,
    });
    return { ok: true, result: { reminders: [...due, ...upcoming].map(describe) } };
  },
});

const createReminderTool = defineTool({
  name: "create_reminder",
  description:
    "Sets a reminder about this letter for the user. Only call it when the user asks for a reminder. Pass the " +
    "date the user named, or a due date a tool returned together with daysBefore (e.g. 2 for 'two days before " +
    "the deadline'); the code counts the days back. The reminder cannot be in the past. Write the note in the " +
    "user's language, short and concrete (what to do).",
  schema: z.object({
    date: isoDate.describe("The day to remind on, or the due date to count back from"),
    daysBefore: z.number().int().min(0).max(90).optional().describe("Days before date; 0 or empty = on date"),
    note: z.string().min(1).max(REMINDER_NOTE_MAX_LENGTH).describe("What the user should do, in their language"),
  }),
  async run({ date, daysBefore = 0, note }, ctx) {
    if (!isIsoDate(date)) return failure(`Invalid date: ${date}`);
    const remindOn = addDays(date, -daysBefore);
    try {
      const reminder = await createReminder({
        userId: ctx.userId,
        documentId: ctx.documentId,
        origin: "CHAT",
        remindOn,
        note,
        today: ctx.today,
      });
      const created = { remindOn: reminder.remindOn, weekday: weekdayName(reminder.remindOn), note: reminder.note };
      return { ok: true, result: { created } };
    } catch (err) {
      if (err instanceof HttpError) return failure(`${err.message} (today is ${ctx.today})`);
      throw err;
    }
  },
});

const delegate = defineTool<DelegateRequest>({
  name: "delegate",
  description:
    'Hands work to another BriefKlar agent. agent "replyWriter" writes a German reply to this letter: a draft ' +
    "the user checks, completes and sends themselves, saved in the reply section of the page. Another model " +
    "checks it for facts that are not in the letter or in the user's words. Types: OBJECTION (Widerspruch or " +
    "Einspruch), EXTENSION_REQUEST (more time), SEND_DOCUMENTS (cover letter for documents), INSTALLMENT_PLAN " +
    "(Ratenzahlung), QUESTION (a question to the sender). Call it whenever the user asks you to write, draft or " +
    "formulate a reply or letter; never write the letter yourself. Put everything the user said that belongs " +
    "in the reply into input.notes, in their words: reasons, amounts they can pay, dates, what they want to ask. " +
    'When it answers "needs_info", ask the user for it in one short message; when they answer, call delegate ' +
    "again with the same type and their answer in input.notes (empty if they want the draft without it).",
  schema: z.object({
    agent: z.enum(DELEGATE_AGENTS).describe('The agent to hand the work to: "replyWriter"'),
    input: z.object({
      type: z.enum(REPLY_TYPES).describe("The kind of reply"),
      notes: z
        .string()
        .max(2000)
        .describe("The user's own words for the reply: reasons, amounts, dates, wishes. Empty if they gave none."),
    }),
  }),
  async run(request, ctx) {
    if (!ctx.delegate) return failure("Reply drafts cannot be written here.");
    if (!ctx.extraction.isOfficialLetter) {
      return failure("This document is not an official letter, so BriefKlar does not write a reply to it.");
    }
    return ctx.delegate(request, ctx.onAgent ?? (() => {}));
  },
});

export const CHAT_TOOLS = [
  getLetterDetails,
  searchKnowledgeBase,
  calculateDeadline,
  checkDate,
  listPublicHolidays,
  listRemindersTool,
  createReminderTool,
  delegate,
] as ChatTool<unknown>[];

/** JSON Schema declarations sent to the model */
export function toolDeclarations(tools: ChatTool<unknown>[] = CHAT_TOOLS): ToolDeclaration[] {
  return tools.map((tool) => {
    const { $schema: _ignored, ...parameters } = z.toJSONSchema(tool.schema) as Record<string, unknown>;
    return { name: tool.name, description: tool.description, parameters };
  });
}

/**
 * Runs the tool the model asked for. Unknown tools and invalid arguments are reported back
 * to the model as errors, so it can correct the call instead of the chat failing.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
  tools: ChatTool<unknown>[] = CHAT_TOOLS,
): Promise<ToolOutput> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return failure(`Unknown tool: ${name}`);
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return failure(`Invalid arguments: ${z.prettifyError(parsed.error)}`);
  return tool.run(parsed.data, context);
}
