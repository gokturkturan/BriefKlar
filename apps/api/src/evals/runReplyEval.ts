import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  MAX_AGENT_HOPS,
  MAX_LLM_CALLS_PER_RUN,
  type AgentPayload,
  type ExplanationLanguage,
  type ReplyBody,
  type ReplyType,
} from "@briefklar/shared";
import { analyseLetter, LETTER_AGENTS } from "../agents/analyseLetter";
import { prismaAgentStore } from "../agents/agentStore";
import type { DocumentCaseFile } from "../agents/documentCaseFile";
import { Orchestrator } from "../agents/orchestrator";
import type { ReplyCaseFile } from "../agents/replyCaseFile";
import type { Agent } from "../agents/types";
import { dropWaitingReplyRuns, REPLY_AGENTS, type ReplyAgents } from "../agents/writeReply";
import { chatSystemPrompt, chatTurnInstruction, CHAT_PROMPT_VERSION } from "../chat/chatPrompt";
import { delegateToAgent } from "../chat/delegateReply";
import { runChat } from "../chat/runChat";
import { todayInGermany } from "../deadlines/calendarDate";
import { requireExtraction } from "../documents/extractions";
import { prisma } from "../lib/prisma";
import { llm, verifierLlm } from "../llm";
import type { ChatTurn } from "../llm/LLMProvider";
import { unsupportedFacts, type UnsupportedFact } from "../replies/replyFacts";

/**
 * Evaluates reply drafts the chat has written (F4) with the production models:
 *   npm run eval:replies -w @briefklar/api
 *   npm run eval:replies -w @briefklar/api -- --only 01,03
 *
 * Each scenario is a user asking the chat, in their language, for a reply to one of the
 * evaluation letters. The letter is analysed first by the agents of an upload (a temporary guest
 * user and document, deleted at the end). The chat runs with the production prompt and tools:
 * it has to hand the work to the reply writer with the delegate tool. When the reply writer asks
 * for details (REPLY_NOTES), the eval answers like the user would and the run goes on.
 *
 * The gate: no fabricated fact in a saved draft. A fact is fabricated when it is a number
 * (amount, date, period, reference number) that neither the letter's text nor the user's
 * messages contain, in any way the same value can be written. The letter's text is the ground
 * truth here, not the analysis the agents work from. Counted for the reply writer's first draft
 * (what a single model would deliver), for the last draft before the code's safeguard and for the
 * saved letter. Also measured: the question asked when (and only when) the user left out what
 * only they know, the kind of reply, the trace (handoff, verifier, limits) and the cost.
 */

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    delay: { type: "string", default: "1" },
  },
});

interface Scenario {
  id: string;
  file: string;
  language: ExplanationLanguage;
  message: string;
  /** What the user answers when the chat asks for the details of the reply */
  answer?: string;
  /** true when the first message leaves out what only the user knows */
  expectQuestion: boolean;
  /** Kinds of reply that fit the request; empty when no draft may be written */
  types: ReplyType[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "01-objection-reason",
    file: "01-finanzamt-einkommensteuer.txt",
    language: "tr",
    message:
      "Bu karara itiraz etmek istiyorum. Evden çalışma odamın giderlerini kabul etmemişler ama odayı sadece iş için " +
      "kullanıyorum. Bana bir itiraz mektubu yazar mısın?",
    expectQuestion: false,
    types: ["OBJECTION"],
  },
  {
    id: "01-objection-later",
    file: "01-finanzamt-einkommensteuer.txt",
    language: "de",
    message: "Schreiben Sie mir bitte einen Einspruch gegen diesen Bescheid.",
    answer: "Die Begründung reiche ich später nach. Bitte schreiben Sie ihn erst einmal ohne.",
    expectQuestion: true,
    types: ["OBJECTION"],
  },
  {
    id: "02-documents",
    file: "02-jobcenter-mitwirkung.txt",
    language: "en",
    message: "Please write a short cover letter for the documents they asked for. I will send everything by post.",
    expectQuestion: false,
    types: ["SEND_DOCUMENTS"],
  },
  {
    id: "02-extension",
    file: "02-jobcenter-mitwirkung.txt",
    language: "ru",
    message: "Напишите, пожалуйста, письмо с просьбой продлить срок.",
    answer: "Я в больнице ещё две недели, мне нужно время до 15 декабря, чтобы собрать документы.",
    expectQuestion: true,
    types: ["EXTENSION_REQUEST"],
  },
  {
    id: "03-instalments",
    file: "03-rundfunkbeitrag-zahlungserinnerung.txt",
    language: "tr",
    message: "Bu borcu bir kerede ödeyemem, taksit isteyen bir mektup yazar mısın?",
    answer: "Ayda 20 euro ödeyebilirim, geçen ay işimi kaybettim.",
    expectQuestion: true,
    types: ["INSTALLMENT_PLAN"],
  },
  {
    id: "04-objection-reason",
    file: "04-familienkasse-rueckforderung.txt",
    language: "ar",
    message:
      "أريد الاعتراض على هذا القرار. ابنتي صوفيا لم تنهِ تدريبها في فبراير، بل بدأت تدريباً جديداً مباشرة في مارس. اكتب لي اعتراضاً من فضلك.",
    expectQuestion: false,
    types: ["OBJECTION"],
  },
  {
    id: "04-instalments-amount",
    file: "04-familienkasse-rueckforderung.txt",
    language: "uk",
    message:
      "Я не можу заплатити все одразу. Напишіть, будь ласка, прохання про розстрочку: я можу платити 100 євро на місяць.",
    expectQuestion: false,
    types: ["INSTALLMENT_PLAN"],
  },
  {
    id: "05-new-appointment",
    file: "05-auslaenderbehoerde-termin.txt",
    language: "en",
    message:
      "I can't come to this appointment because I am on a business trip that week. Can you write to them and ask for a new appointment?",
    expectQuestion: false,
    types: ["EXTENSION_REQUEST", "QUESTION"],
  },
  {
    id: "06-instalments-amount",
    file: "06-krankenkasse-beitragsrueckstand.txt",
    language: "de",
    message: "Können Sie für mich eine Ratenzahlung beantragen? 60 Euro im Monat kann ich zahlen.",
    expectQuestion: false,
    types: ["INSTALLMENT_PLAN"],
  },
  {
    id: "07-receipts",
    file: "07-vermieter-betriebskosten.txt",
    language: "tr",
    message: "Ev yönetimine, yan gider faturalarının belgelerini görmek istediğimi söyleyen bir mektup yazar mısın?",
    expectQuestion: false,
    types: ["QUESTION"],
  },
  {
    id: "10-dispute-calls",
    file: "10-mobilfunk-rechnung.txt",
    language: "tr",
    message: "Faturadaki Türkiye görüşmelerini ben yapmadım. Buna itiraz eden bir mektup yazar mısın?",
    expectQuestion: false,
    types: ["OBJECTION", "QUESTION"],
  },
  {
    id: "11-private-letter",
    file: "11-private-einladung.txt",
    language: "de",
    message: "Schreiben Sie bitte eine Antwort auf diesen Brief.",
    expectQuestion: false,
    types: [],
  },
];

const lettersDir = new URL("./letters/", import.meta.url);
const resultsDir = new URL("../../eval-results/", import.meta.url);
const prefixes = args.only?.split(",").map((prefix) => prefix.trim());
const scenarios = SCENARIOS.filter((s) => !prefixes || prefixes.some((prefix) => s.id.startsWith(prefix)));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const usd = (value: number) => `$${value.toFixed(5)}`;

interface TraceCheck {
  rule: string;
  ok: boolean;
  detail: string;
}

interface ScenarioResult {
  id: string;
  file: string;
  language: string;
  status: "DONE" | "FAILED";
  error?: string;
  /** Chat messages the user sent (1, or 2 after a question) */
  turns: number;
  asked: boolean;
  questionOk: boolean;
  draftType: ReplyType | null;
  typeOk: boolean;
  /** Fabricated numbers: the reply writer's first draft, the last draft before the safeguard, the saved letter */
  fabricatedFirst: UnsupportedFact[];
  fabricatedBeforeGuard: UnsupportedFact[];
  fabricatedSaved: UnsupportedFact[];
  /** Numbers the safeguard replaced with a placeholder */
  replaced: number;
  /** Issues the verifier still reported on the last draft */
  issuesLeft: number;
  corrected: boolean;
  answers: string[];
  /** What the chat passed on to the reply writer: the handoff's notes and the answer to the question */
  notes: string[];
  /** The saved letter, for reading the result */
  draft: string | null;
  path: string[];
  llmCallsAgents: number;
  llmCallsChat: number;
  costUsd: number;
  seconds: number;
  trace: TraceCheck[];
}

/** The reply agents of production, with the reply writer's drafts and the verifier's last verdict kept */
function instrumented(log: {
  drafts: Pick<ReplyBody, "subject" | "paragraphs">[];
  issues: number;
  replaced: number;
}): ReplyAgents {
  const writer: Agent<ReplyCaseFile> = {
    ...REPLY_AGENTS.replyWriter,
    async handle(task, context) {
      const reply = await REPLY_AGENTS.replyWriter.handle(task, context);
      const { body } = context.caseFile;
      if (reply.kind === "result" && body) log.drafts.push({ subject: body.subject, paragraphs: [...body.paragraphs] });
      return reply;
    },
  };
  const verifier: Agent<ReplyCaseFile> = {
    ...REPLY_AGENTS.verifier,
    async handle(task, context) {
      const reply = await REPLY_AGENTS.verifier.handle(task, context);
      log.issues = context.caseFile.verdict?.issues.length ?? 0;
      return reply;
    },
  };
  const research: Agent<ReplyCaseFile> = {
    ...REPLY_AGENTS.research,
    async handle(task, context) {
      // Runs after the safeguard: the numbers it replaced are known by now
      log.replaced = context.caseFile.replaced?.length ?? 0;
      return REPLY_AGENTS.research.handle(task, context);
    },
  };
  return { replyWriter: writer, verifier, research };
}

/** Analyses a letter once, like an upload, for all its scenarios */
async function analysed(file: string, userId: string): Promise<string> {
  const text = await readFile(new URL(file, lettersDir));
  const doc = await prisma.document.create({
    data: {
      userId,
      originalName: file,
      fileKey: `eval/${crypto.randomUUID()}-${file}`,
      mimeType: "text/plain",
      sizeBytes: text.length,
      status: "PROCESSING",
    },
  });
  const run = await prismaAgentStore.startRun(doc.id, "UPLOAD");
  const caseFile: DocumentCaseFile = {
    documentId: doc.id,
    fileKey: doc.fileKey,
    mimeType: "text/plain",
    language: null,
    file: text,
  };
  const orchestrator = new Orchestrator(run.id, caseFile, { store: prismaAgentStore, onProgress: async () => {} });
  await analyseLetter(orchestrator, LETTER_AGENTS);
  await orchestrator.finish();
  await prisma.document.update({ where: { id: doc.id }, data: { status: "DONE" } });
  return doc.id;
}

async function runScenario(scenario: Scenario, documentId: string): Promise<ScenarioResult> {
  const startedAt = new Date();
  const letter = (await readFile(new URL(scenario.file, lettersDir))).toString("utf8");
  const extraction = await requireExtraction(documentId);
  const [deadlines, actionItems] = await Promise.all([
    prisma.deadline.findMany({ where: { documentId }, orderBy: { dueDate: "asc" } }),
    prisma.actionItem.findMany({ where: { documentId }, orderBy: { position: "asc" } }),
  ]);
  await dropWaitingReplyRuns(documentId);

  const today = todayInGermany();
  const log = { drafts: [] as Pick<ReplyBody, "subject" | "paragraphs">[], issues: 0, replaced: 0 };
  const agents = instrumented(log);
  const outcomes: string[] = [];
  const history: ChatTurn[] = [];
  const answers: string[] = [];
  const userMessages: string[] = [];
  let draftId: string | null = null;
  let error: string | undefined;

  const send = async (message: string) => {
    userMessages.push(message);
    const answer = await runChat({
      provider: llm,
      system: chatSystemPrompt({ language: scenario.language, today, state: null }),
      promptVersion: CHAT_PROMPT_VERSION,
      history,
      message,
      instruction: chatTurnInstruction(scenario.language),
      context: {
        userId: "eval",
        documentId,
        today,
        state: null,
        extraction,
        receivedDate: null,
        deadlines,
        actionItems: actionItems.map(({ text, done }) => ({ text, done })),
        delegate: async (request, onAgent) => {
          const output = await delegateToAgent(documentId, scenario.language, request, onAgent, agents);
          outcomes.push(String(output.result.status ?? (output.ok ? "?" : "error")));
          return output;
        },
      },
      onEvent: () => {},
    });
    history.push(
      { role: "user", parts: [{ type: "text", text: message }] },
      { role: "model", parts: [{ type: "text", text: answer.text }] },
    );
    answers.push(answer.text);
    draftId = answer.replyDraft?.id ?? draftId;
  };

  try {
    await send(scenario.message);
    if (!draftId && scenario.answer && outcomes.includes("needs_info")) await send(scenario.answer);
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  const [draft, runs, chatCalls] = await Promise.all([
    draftId ? prisma.replyDraft.findUnique({ where: { id: draftId } }) : null,
    prisma.agentRun.findMany({
      where: { documentId, trigger: "CHAT", startedAt: { gte: startedAt } },
      orderBy: { startedAt: "asc" },
      include: { messages: { orderBy: { hop: "asc" } }, calls: true },
    }),
    prisma.llmCall.findMany({ where: { documentId, agentRunId: null, createdAt: { gte: startedAt } } }),
  ]);

  // Ground truth: the letter as written and everything the user said
  const truth = [letter, ...userMessages, today];
  const fabricated = (body: Pick<ReplyBody, "subject" | "paragraphs"> | undefined) =>
    body ? unsupportedFacts(body, truth) : [];
  const asked = outcomes.includes("needs_info");
  const draftType = (draft?.type as ReplyType | undefined) ?? null;

  const trace: TraceCheck[] = [];
  for (const run of runs) {
    const questions = run.messages.filter((m) => m.kind === "question");
    const first = run.messages[0];
    const tasks = run.messages.filter((m) => m.kind === "task").map((m) => m.to);
    trace.push(
      { rule: `messages ≤ ${MAX_AGENT_HOPS}`, ok: run.hops <= MAX_AGENT_HOPS, detail: String(run.hops) },
      {
        rule: `model requests ≤ ${MAX_LLM_CALLS_PER_RUN}`,
        ok: run.calls.length <= MAX_LLM_CALLS_PER_RUN,
        detail: String(run.calls.length),
      },
      { rule: "at most one question", ok: questions.length <= 1, detail: String(questions.length) },
      {
        rule: "starts with a handoff from the chat",
        ok: first?.kind === "handoff" && first.from === "chat" && first.to === "replyWriter",
        detail: first ? `${first.from}→${first.to} ${first.kind}` : "-",
      },
      {
        rule: "a draft run is checked by the verifier",
        ok: run.status !== "DONE" || tasks.includes("verifier"),
        detail: tasks.join(" → "),
      },
      { rule: "run finished", ok: run.status === "DONE", detail: run.status },
    );
  }
  if (draft) {
    trace.push({
      rule: "the chat did not write the letter itself",
      ok: !answers.some((a) => /Sehr geehrte|Mit freundlichen Grüßen/.test(a)),
      detail: "",
    });
  }

  const savedBody = draft ? { subject: "", paragraphs: [draft.contentDe] } : undefined;
  return {
    id: scenario.id,
    file: scenario.file,
    language: scenario.language,
    status: error ? "FAILED" : "DONE",
    error,
    turns: userMessages.length,
    asked,
    questionOk: asked === scenario.expectQuestion,
    draftType,
    typeOk: scenario.types.length === 0 ? !draft : draftType !== null && scenario.types.includes(draftType),
    fabricatedFirst: fabricated(log.drafts[0]),
    fabricatedBeforeGuard: fabricated(log.drafts.at(-1)),
    fabricatedSaved: fabricated(savedBody),
    replaced: log.replaced,
    issuesLeft: log.issues,
    corrected: log.drafts.length > 1,
    answers,
    notes: runs.flatMap((run) =>
      run.messages.flatMap((m) => {
        const payload = m.payload as AgentPayload;
        if (payload.kind === "handoff") return [String(payload.input.notes ?? "")];
        if (payload.kind === "answer") return [payload.value ?? ""];
        return [];
      }),
    ),
    draft: draft?.contentDe ?? null,
    path: runs.flatMap((run) =>
      run.messages
        .filter((m) => m.kind === "task" || m.kind === "answer" || m.kind === "handoff")
        .map((m) => {
          if (m.kind === "answer") return "[answer]";
          if (m.kind === "handoff") return "handoff";
          const notes = (m.payload as Extract<AgentPayload, { kind: "task" }>).notes ?? [];
          return notes.length > 0 ? `${m.to}+notes` : m.to;
        }),
    ),
    llmCallsAgents: sum(runs.map((r) => r.calls.length)),
    llmCallsChat: chatCalls.length,
    costUsd: sum([...runs.flatMap((r) => r.calls), ...chatCalls].map((c) => Number(c.costUsd))),
    seconds: (Date.now() - startedAt.getTime()) / 1000,
    trace,
  };
}

function summarize(results: ScenarioResult[]) {
  const drafted = results.filter((r) => r.draftType);
  return {
    scenarios: results.length,
    failed: results.filter((r) => r.status === "FAILED").length,
    drafts: drafted.length,
    expectedDrafts: results.filter((r) => SCENARIOS.find((s) => s.id === r.id)!.types.length > 0).length,
    typeOk: results.filter((r) => r.typeOk).length,
    questionOk: results.filter((r) => r.questionOk).length,
    asked: results.filter((r) => r.asked).length,
    fabricatedFirst: sum(drafted.map((r) => r.fabricatedFirst.length)),
    fabricatedBeforeGuard: sum(drafted.map((r) => r.fabricatedBeforeGuard.length)),
    fabricatedSaved: sum(drafted.map((r) => r.fabricatedSaved.length)),
    draftsWithFabricatedFirst: drafted.filter((r) => r.fabricatedFirst.length > 0).length,
    corrected: drafted.filter((r) => r.corrected).length,
    replaced: sum(drafted.map((r) => r.replaced)),
    issuesLeft: sum(drafted.map((r) => r.issuesLeft)),
    llmCallsAgents: sum(results.map((r) => r.llmCallsAgents)),
    llmCallsChat: sum(results.map((r) => r.llmCallsChat)),
    costUsd: sum(results.map((r) => r.costUsd)),
    secondsPerDraft: sum(drafted.map((r) => r.seconds)) / Math.max(1, drafted.length),
    traceFailures: results.flatMap((r) => r.trace.filter((t) => !t.ok).map((t) => ({ id: r.id, ...t }))),
  };
}

const facts = (list: UnsupportedFact[]) => (list.length ? list.map((f) => f.text).join(", ") : "–");

function markdownReport(summary: ReturnType<typeof summarize>, results: ScenarioResult[], startedAt: Date): string {
  const lines = [
    `# Evaluation: reply drafts from the chat (F4)`,
    ``,
    `- Date: ${startedAt.toISOString()}`,
    `- Models: ${llm.model} (chat, reply writer), ${verifierLlm?.model ?? "no verifier"} (verifier)`,
    `- Scenarios: ${summary.scenarios} requests in the chat, 6 languages, ${summary.expectedDrafts} should give a draft`,
    `- Fabricated: a number (amount, date, period, reference) of the German text that neither the letter's text nor the user's messages contain`,
    ``,
    `| Fabricated numbers | Reply writer's first draft | After the verifier's correction | Saved draft (gate) |`,
    `|---|---|---|---|`,
    `| Count | ${summary.fabricatedFirst} (in ${summary.draftsWithFabricatedFirst} drafts) | ${summary.fabricatedBeforeGuard} | **${summary.fabricatedSaved}** |`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Drafts saved | ${summary.drafts} of ${summary.expectedDrafts} |`,
    `| Right kind of reply (or none for a private letter) | ${summary.typeOk} of ${summary.scenarios} |`,
    `| Question asked exactly when details were missing | ${summary.questionOk} of ${summary.scenarios} (asked ${summary.asked}×) |`,
    `| Drafts corrected after the verifier | ${summary.corrected} |`,
    `| Numbers the safeguard turned into placeholders | ${summary.replaced} |`,
    `| Verifier issues left on saved drafts | ${summary.issuesLeft} |`,
    `| Model requests: agents / chat | ${summary.llmCallsAgents} / ${summary.llmCallsChat} |`,
    `| Seconds per draft (whole conversation) | ${summary.secondsPerDraft.toFixed(1)} |`,
    `| Failed scenarios | ${summary.failed} |`,
    `| Cost | ${usd(summary.costUsd)} |`,
    ``,
    `## Trace checks`,
    ``,
    summary.traceFailures.length === 0
      ? `All rules held in every scenario.`
      : summary.traceFailures.map((f) => `- **${f.id}** ${f.rule} (${f.detail})`).join("\n"),
    ``,
    `## Scenarios`,
    ``,
    `| Scenario | Lang | Asked | Draft | Fabricated: first / before guard / saved | Issues left | Path | Requests | Cost |`,
    `|---|---|---|---|---|---|---|---|---|`,
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.language} | ${r.asked ? "yes" : "no"}${r.questionOk ? "" : " ✗"} | ${r.draftType ?? "–"}${r.typeOk ? "" : " ✗"} | ` +
        `${facts(r.fabricatedFirst)} / ${facts(r.fabricatedBeforeGuard)} / ${facts(r.fabricatedSaved)} | ${r.issuesLeft} | ` +
        `${r.path.join(" → ")}${r.error ? ` (${r.error.slice(0, 80)})` : ""} | ${r.llmCallsAgents}+${r.llmCallsChat} | ${usd(r.costUsd)} |`,
    ),
    ``,
    `## Chat answers`,
    ``,
    ...results.flatMap((r) => [`**${r.id}**`, ``, ...r.answers.map((a) => `> ${a.replace(/\n+/g, " ")}`), ``]),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = new Date();
  console.log(`Reply eval: ${scenarios.length} scenarios\n`);
  // A guest without e-mail; deleting it and its documents removes the runs, drafts and messages
  const user = await prisma.user.create({ data: { preferredLanguage: "en" } });
  const documents = new Map<string, string>();

  const results: ScenarioResult[] = [];
  try {
    for (const [index, scenario] of scenarios.entries()) {
      if (index > 0) await sleep(Number(args.delay) * 1000);
      let documentId = documents.get(scenario.file);
      if (!documentId) {
        documentId = await analysed(scenario.file, user.id);
        documents.set(scenario.file, documentId);
      }
      const result = await runScenario(scenario, documentId);
      results.push(result);
      const broken = result.trace.filter((t) => !t.ok).map((t) => `${t.rule} (${t.detail})`);
      console.log(
        `${(result.draftType ?? "-").padEnd(17)} asked ${result.asked ? "y" : "n"} fabricated ` +
          `${result.fabricatedFirst.length}/${result.fabricatedBeforeGuard.length}/${result.fabricatedSaved.length} ` +
          `${usd(result.costUsd)}  ${result.id}  ${result.path.join(" → ")}` +
          `${result.error ? `\n     ${result.error}` : ""}${broken.length ? `\n     trace: ${broken.join(", ")}` : ""}`,
      );
    }
  } finally {
    // Documents first: deleting the user alone would reach each LlmCall row on two paths at once
    await prisma.document.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  const summary = summarize(results);
  const name = `${startedAt.toISOString().replace(/[:.]/g, "-")}-replies-${llm.model}`;
  await mkdir(resultsDir, { recursive: true });
  await writeFile(new URL(`${name}.json`, resultsDir), JSON.stringify({ summary, results }, null, 2));
  await writeFile(new URL(`${name}.md`, resultsDir), markdownReport(summary, results, startedAt));
  console.log(
    `\nFabricated numbers: ${summary.fabricatedFirst} in first drafts, ${summary.fabricatedBeforeGuard} before the safeguard, ` +
      `${summary.fabricatedSaved} saved; drafts ${summary.drafts}/${summary.expectedDrafts}, trace failures ${summary.traceFailures.length}`,
  );
  console.log(`Report: apps/api/eval-results/${name}.md`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
