import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { MAX_AGENT_HOPS, MAX_LLM_CALLS_PER_RUN, type AgentPayload } from "@briefklar/shared";
import { analyseLetter, LETTER_AGENTS } from "../agents/analyseLetter";
import { prismaAgentStore } from "../agents/agentStore";
import type { DocumentCaseFile } from "../agents/documentCaseFile";
import { Orchestrator } from "../agents/orchestrator";
import { resumeLetterRun } from "../agents/resumeRun";
import { addDays, weekday } from "../deadlines/calendarDate";
import { prisma } from "../lib/prisma";
import { llm, verifierLlm } from "../llm";
import { EVAL_CASES, type EvalCase } from "./cases";
import { scoreExtraction, type FieldCheck } from "./score";

/**
 * Evaluates the question to the user (F3) on the evaluation letters with the production models:
 *   npm run eval:questions -w @briefklar/api
 *   npm run eval:questions -w @briefklar/api -- --only 01,03 --language en
 *
 * Each letter runs the whole plan of an upload as a real agent run (a temporary guest user and
 * document, deleted at the end). The user has entered neither a delivery date nor a federal
 * state. When the deadline agent asks, the eval answers like a user would (the letter arrived
 * two days after its date, not on a Sunday) and the run goes on through the same code as the
 * question card (resumeLetterRun). Compared per letter: the estimated due dates before the
 * answer (what every letter showed before F3) and after it.
 *
 * Trace checks: at most one question per run, the run waits after the question and is done after
 * the answer, the answer answers the question message, the resumed run makes no model request
 * and gives no task to the intake agent, the extractor, the verifier or the translator again,
 * and the run stays within MAX_AGENT_HOPS messages and MAX_LLM_CALLS_PER_RUN requests.
 */
const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    // A reader who needs the translation, so the trace shows that it is not made twice
    language: { type: "string", default: "tr" },
    delay: { type: "string", default: "1" },
  },
});

const lettersDir = new URL("./letters/", import.meta.url);
const resultsDir = new URL("../../eval-results/", import.meta.url);
const prefixes = args.only?.split(",").map((prefix) => prefix.trim());
const cases = EVAL_CASES.filter((c) => !prefixes || prefixes.some((prefix) => c.file.startsWith(prefix)));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const usd = (value: number) => `$${value.toFixed(5)}`;
const percent = (value: number) => `${(value * 100).toFixed(1)} %`;

interface TraceCheck {
  rule: string;
  ok: boolean;
  detail: string;
}

interface QuestionResult {
  file: string;
  status: "DONE" | "FAILED";
  error?: string;
  question: string | null;
  answer: string | null;
  deadlines: number;
  estimatedBefore: number;
  estimatedAfter: number;
  /** Due dates that the answer moved */
  moved: number;
  hops: number;
  llmCalls: number;
  llmCallsAfterAnswer: number;
  costUsd: number;
  checks: FieldCheck[];
  path: string[];
  trace: TraceCheck[];
}

/** The day a user would enter: two days after the letter's date, Monday instead of Sunday */
function simulatedReceivedDate(letterDate: string): string {
  const date = addDays(letterDate, 2);
  return weekday(date) === 0 ? addDays(date, 1) : date;
}

const dueDates = async (documentId: string) =>
  prisma.deadline.findMany({ where: { documentId }, orderBy: [{ kind: "asc" }, { sourceText: "asc" }] });

async function runLetter(testCase: EvalCase, userId: string): Promise<QuestionResult> {
  const mimeType = MIME_TYPES[extname(testCase.file).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported file type: ${testCase.file}`);
  const file = await readFile(new URL(testCase.file, lettersDir));

  const doc = await prisma.document.create({
    data: {
      userId,
      originalName: testCase.file,
      fileKey: `eval/${crypto.randomUUID()}-${testCase.file}`,
      mimeType,
      sizeBytes: file.length,
      status: "PROCESSING",
    },
  });
  const run = await prismaAgentStore.startRun(doc.id, "UPLOAD");
  const caseFile: DocumentCaseFile = {
    documentId: doc.id,
    fileKey: doc.fileKey,
    mimeType,
    language: args.language === "en" ? null : (args.language as DocumentCaseFile["language"]),
    file,
  };
  const orchestrator = new Orchestrator(run.id, caseFile, { store: prismaAgentStore, onProgress: async () => {} });

  let error: string | undefined;
  let question: string | null = null;
  let answer: string | null = null;
  let llmCallsBeforeAnswer = 0;
  let hopsBeforeAnswer = 0;
  let before: Awaited<ReturnType<typeof dueDates>> = [];
  let statusWhileWaiting: string | null = null;

  try {
    await analyseLetter(orchestrator, LETTER_AGENTS);
    await prisma.document.update({ where: { id: doc.id }, data: { status: "DONE" } });
    question = await orchestrator.finish();
    before = await dueDates(doc.id);
    const waiting = await prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } });
    statusWhileWaiting = waiting.status;
    llmCallsBeforeAnswer = waiting.llmCalls;
    hopsBeforeAnswer = waiting.hops;

    if (question === "RECEIVED_DATE") {
      const letterDate = caseFile.extraction?.letterDate;
      answer = letterDate ? simulatedReceivedDate(letterDate) : null;
      if (answer) {
        await prisma.document.update({ where: { id: doc.id }, data: { receivedDate: new Date(`${answer}T00:00:00Z`) } });
      }
      if (!(await resumeLetterRun(doc.id, { question, value: answer }))) throw new Error("The run did not resume");
    } else if (question === "FEDERAL_STATE") {
      answer = "BY";
      await prisma.user.update({ where: { id: userId }, data: { state: answer } });
      if (!(await resumeLetterRun(doc.id, { question, value: answer }))) throw new Error("The run did not resume");
    }
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await prismaAgentStore.finishRun(run.id, "FAILED", "EVAL");
  } finally {
    // The next letter starts without a state, like a new user
    await prisma.user.update({ where: { id: userId }, data: { state: null } });
  }

  const [after, messages, calls, stored] = await Promise.all([
    dueDates(doc.id),
    prisma.agentMessage.findMany({ where: { runId: run.id }, orderBy: { hop: "asc" } }),
    prisma.llmCall.findMany({ where: { agentRunId: run.id } }),
    prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } }),
  ]);
  if (before.length === 0) before = after;

  const tasks = messages.filter((m) => m.kind === "task");
  const questions = messages.filter((m) => m.kind === "question" && (m.payload as { askUser?: boolean }).askUser);
  const answerMessage = messages.find((m) => m.kind === "answer");
  const resumedTasks = tasks.filter((m) => m.hop >= hopsBeforeAnswer).map((m) => m.to);
  const key = (d: { kind: string; sourceText: string }) => `${d.kind}|${d.sourceText}`;
  const beforeByKey = new Map(before.map((d) => [key(d), d.dueDate.toISOString()]));

  const trace: TraceCheck[] = [
    { rule: `messages ≤ ${MAX_AGENT_HOPS}`, ok: stored.hops <= MAX_AGENT_HOPS, detail: String(stored.hops) },
    { rule: `model requests ≤ ${MAX_LLM_CALLS_PER_RUN}`, ok: calls.length <= MAX_LLM_CALLS_PER_RUN, detail: String(calls.length) },
    { rule: "at most one question to the user", ok: questions.length <= 1, detail: String(questions.length) },
    { rule: "deadline agent without model requests", ok: !calls.some((c) => c.agent === "deadline"), detail: "" },
  ];
  if (question) {
    trace.push(
      { rule: "run waits after the question", ok: statusWhileWaiting === "WAITING_FOR_USER", detail: String(statusWhileWaiting) },
      { rule: "run done after the answer", ok: stored.status === "DONE", detail: stored.status },
      { rule: "answer answers the question", ok: answerMessage?.parentId === questions[0]?.id, detail: answerMessage ? "linked" : "no answer" },
      {
        rule: "no model request after the answer",
        ok: stored.llmCalls === llmCallsBeforeAnswer,
        detail: String(stored.llmCalls - llmCallsBeforeAnswer),
      },
      {
        rule: "resumed at the deadline agent only",
        ok: resumedTasks.length === 1 && resumedTasks[0] === "deadline",
        detail: resumedTasks.join(" → ") || "-",
      },
    );
  } else {
    trace.push({ rule: "run done without a question", ok: stored.status === "DONE", detail: stored.status });
  }

  return {
    file: testCase.file,
    status: error ? "FAILED" : "DONE",
    error,
    question,
    answer,
    deadlines: after.length,
    estimatedBefore: before.filter((d) => d.isEstimate).length,
    estimatedAfter: after.filter((d) => d.isEstimate).length,
    moved: after.filter((d) => beforeByKey.has(key(d)) && beforeByKey.get(key(d)) !== d.dueDate.toISOString()).length,
    hops: stored.hops,
    llmCalls: calls.length,
    llmCallsAfterAnswer: stored.llmCalls - llmCallsBeforeAnswer,
    costUsd: sum(calls.map((c) => Number(c.costUsd))),
    checks: caseFile.extraction ? scoreExtraction(testCase, caseFile.extraction) : [],
    path: tasks.map((m) => {
      const notes = (m.payload as Extract<AgentPayload, { kind: "task" }>).notes ?? [];
      const step = notes.length > 0 ? `${m.to}+notes` : m.to;
      return answerMessage && m.hop > answerMessage.hop ? `[answer] ${step}` : step;
    }),
    trace,
  };
}

function summarize(results: QuestionResult[]) {
  const asked = results.filter((r) => r.question);
  const withEstimates = results.filter((r) => r.estimatedBefore > 0);
  const checks = results.flatMap((r) => r.checks);
  return {
    letters: results.length,
    failed: results.filter((r) => r.status === "FAILED").length,
    deadlines: sum(results.map((r) => r.deadlines)),
    estimatedBefore: sum(results.map((r) => r.estimatedBefore)),
    estimatedAfter: sum(results.map((r) => r.estimatedAfter)),
    lettersWithEstimates: withEstimates.length,
    lettersWithEstimatesAfter: results.filter((r) => r.estimatedAfter > 0).length,
    asked: asked.length,
    byQuestion: Object.fromEntries(
      [...new Set(asked.map((r) => r.question!))].map((q) => [q, asked.filter((r) => r.question === q).length]),
    ),
    moved: sum(results.map((r) => r.moved)),
    llmCallsAfterAnswer: sum(results.map((r) => r.llmCallsAfterAnswer)),
    costUsd: sum(results.map((r) => r.costUsd)),
    fieldAccuracy: checks.filter((c) => c.ok).length / Math.max(1, checks.length),
    traceFailures: results.flatMap((r) => r.trace.filter((t) => !t.ok).map((t) => ({ file: r.file, ...t }))),
  };
}

function markdownReport(summary: ReturnType<typeof summarize>, results: QuestionResult[], startedAt: Date): string {
  const lines = [
    `# Evaluation: questions to the user (F3)`,
    ``,
    `- Date: ${startedAt.toISOString()}`,
    `- Models: ${llm.model} (intake, extractor), ${verifierLlm?.model ?? "no verifier"} (verifier)`,
    `- Letters: ${summary.letters}, reader language ${args.language}, no delivery date and no federal state entered`,
    `- Simulated answer: the letter arrived two days after its date (Monday instead of Sunday)`,
    ``,
    `| Metric | Without the question (before F3) | After the answer (F3) |`,
    `|---|---|---|`,
    `| Estimated due dates | ${summary.estimatedBefore} of ${summary.deadlines} | ${summary.estimatedAfter} of ${summary.deadlines} |`,
    `| Letters with an estimated due date | ${summary.lettersWithEstimates} | ${summary.lettersWithEstimatesAfter} |`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Letters with a question | ${summary.asked} (${Object.entries(summary.byQuestion).map(([q, n]) => `${q} ${n}`).join(", ") || "none"}) |`,
    `| Due dates the answer moved | ${summary.moved} |`,
    `| Model requests after the answer | ${summary.llmCallsAfterAnswer} |`,
    `| Field accuracy of the analysis | ${percent(summary.fieldAccuracy)} |`,
    `| Failed runs | ${summary.failed} |`,
    `| Cost | ${usd(summary.costUsd)} |`,
    ``,
    `## Trace checks`,
    ``,
    summary.traceFailures.length === 0
      ? `All rules held on every letter.`
      : summary.traceFailures.map((f) => `- **${f.file}** ${f.rule} (${f.detail})`).join("\n"),
    ``,
    `## Letters`,
    ``,
    `| Letter | Question | Answer | Estimated before → after | Moved | Path | Requests | Messages |`,
    `|---|---|---|---|---|---|---|---|`,
    ...results.map(
      (r) =>
        `| ${r.file} | ${r.question ?? "–"} | ${r.answer ?? "–"} | ${r.estimatedBefore} → ${r.estimatedAfter} of ${r.deadlines} | ` +
        `${r.moved} | ${r.path.join(" → ")}${r.error ? ` (${r.error.slice(0, 80)})` : ""} | ${r.llmCalls} | ${r.hops} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = new Date();
  console.log(`Question eval: ${cases.length} letters\n`);
  // A guest without e-mail; deleting it and its documents removes the runs and messages of the eval
  const user = await prisma.user.create({ data: { preferredLanguage: args.language } });

  const results: QuestionResult[] = [];
  try {
    for (const [index, testCase] of cases.entries()) {
      if (index > 0) await sleep(Number(args.delay) * 1000);
      const result = await runLetter(testCase, user.id);
      results.push(result);
      const broken = result.trace.filter((t) => !t.ok).map((t) => `${t.rule} (${t.detail})`);
      console.log(
        `${(result.question ?? "-").padEnd(13)} estimated ${result.estimatedBefore}→${result.estimatedAfter}/${result.deadlines} ` +
          `${result.llmCalls} req ${usd(result.costUsd)}  ${testCase.file}  ${result.path.join(" → ")}` +
          `${result.error ? `\n     ${result.error}` : ""}${broken.length ? `\n     trace: ${broken.join(", ")}` : ""}`,
      );
    }
  } finally {
    // Documents first: deleting the user alone would reach each LlmCall row on two paths at once
    await prisma.document.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  const summary = summarize(results);
  const name = `${startedAt.toISOString().replace(/[:.]/g, "-")}-questions-${llm.model}`;
  await mkdir(resultsDir, { recursive: true });
  await writeFile(new URL(`${name}.json`, resultsDir), JSON.stringify({ summary, results }, null, 2));
  await writeFile(new URL(`${name}.md`, resultsDir), markdownReport(summary, results, startedAt));
  console.log(
    `\nEstimated due dates: ${summary.estimatedBefore}/${summary.deadlines} before, ${summary.estimatedAfter}/${summary.deadlines} after the answer; ` +
      `questions ${summary.asked}, trace failures ${summary.traceFailures.length}`,
  );
  console.log(`Report: apps/api/eval-results/${name}.md`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
