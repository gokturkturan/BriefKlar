import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import {
  MAX_AGENT_HOPS,
  MAX_LLM_CALLS_PER_RUN,
  type AgentName,
  type AgentPayload,
  type LetterExtraction,
} from "@briefklar/shared";
import { analyseLetter, LETTER_AGENTS } from "../agents/analyseLetter";
import { prismaAgentStore } from "../agents/agentStore";
import type { DocumentCaseFile } from "../agents/documentCaseFile";
import { Orchestrator } from "../agents/orchestrator";
import { CLASSIFY_LETTER_PROMPT_VERSION } from "../documents/classifyLetter";
import { EXTRACT_LETTER_PROMPT_VERSION } from "../documents/extractLetter";
import { prisma } from "../lib/prisma";
import { llm, verifierLlm } from "../llm";
import { EVAL_CASES, type EvalCase } from "./cases";
import { scoreExtraction, type FieldCheck } from "./score";

/**
 * Runs the whole agent plan of an upload (agents/analyseLetter.ts) on the evaluation letters,
 * once as before the intake agent (F1: extractor, verifier, deadline agent) and once with it
 * (F2), with the production models and fallbacks:
 *   npm run eval:pipeline -w @briefklar/api
 *   npm run eval:pipeline -w @briefklar/api -- --only 10,11 --plans f2
 *
 * Each run is a real agent run in the database (a temporary guest user and document, deleted
 * at the end; the LlmCall rows stay, without the user), so the scores come from the stored
 * trace: the analysis, the messages and the model requests of each agent with their cost.
 * Trace checks: at most MAX_AGENT_HOPS messages and MAX_LLM_CALLS_PER_RUN requests, at most one
 * correction round, no request by the deadline agent, and no extractor for a letter that is not
 * an official one.
 */
const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

const PLANS = ["f1", "f2"] as const;
type Plan = (typeof PLANS)[number];
const PLAN_NAMES: Record<Plan, string> = { f1: "Without intake (F1)", f2: "With intake (F2)" };

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    plans: { type: "string", default: PLANS.join(",") },
    delay: { type: "string", default: "1" },
  },
});

const plans = args.plans.split(",").map((p) => p.trim()).filter((p): p is Plan => (PLANS as readonly string[]).includes(p));
const lettersDir = new URL("./letters/", import.meta.url);
const resultsDir = new URL("../../eval-results/", import.meta.url);
const prefixes = args.only?.split(",").map((prefix) => prefix.trim());
const cases = EVAL_CASES.filter((c) => !prefixes || prefixes.some((prefix) => c.file.startsWith(prefix)));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const usd = (value: number) => `$${value.toFixed(5)}`;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

interface AgentUsage {
  agent: string;
  calls: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

interface TraceCheck {
  rule: string;
  ok: boolean;
  detail: string;
}

interface RunResult {
  file: string;
  plan: Plan;
  official: boolean;
  status: "DONE" | "FAILED";
  error?: string;
  /** Agents in the order they got a task */
  path: string[];
  checks: FieldCheck[];
  intake?: { isOfficialLetter: boolean; letterType: string; language: string; scanQuality: string; model: string };
  intakeChecks: FieldCheck[];
  hops: number;
  llmCalls: number;
  costUsd: number;
  latencyMs: number;
  byAgent: AgentUsage[];
  trace: TraceCheck[];
}

async function runLetter(testCase: EvalCase, plan: Plan, userId: string): Promise<RunResult> {
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
  // English reader: no translation, so both plans make the same requests apart from the intake
  const caseFile: DocumentCaseFile = {
    documentId: doc.id,
    fileKey: doc.fileKey,
    mimeType,
    language: null,
    file,
    skipIntake: plan === "f1",
  };
  const orchestrator = new Orchestrator(run.id, caseFile, { store: prismaAgentStore, onProgress: async () => {} });

  const startedAt = Date.now();
  let error: string | undefined;
  try {
    await analyseLetter(orchestrator, LETTER_AGENTS);
    await prismaAgentStore.finishRun(run.id, "DONE");
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await prismaAgentStore.finishRun(run.id, "FAILED", "EVAL");
  }
  const latencyMs = Date.now() - startedAt;

  const [messages, calls, stored] = await Promise.all([
    prisma.agentMessage.findMany({ where: { runId: run.id }, orderBy: { hop: "asc" } }),
    prisma.llmCall.findMany({ where: { agentRunId: run.id } }),
    prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } }),
  ]);

  const tasks = messages.filter((m) => m.kind === "task");
  const path = tasks.map((m) => {
    const notes = (m.payload as Extract<AgentPayload, { kind: "task" }>).notes ?? [];
    return notes.length > 0 ? `${m.to}+notes` : m.to;
  });
  const byAgent = new Map<string, AgentUsage>();
  for (const call of calls) {
    const name = call.agent ?? "?";
    const entry = byAgent.get(name) ?? { agent: name, calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
    entry.calls += 1;
    entry.costUsd += Number(call.costUsd);
    entry.inputTokens += call.inputTokens;
    entry.outputTokens += call.outputTokens;
    byAgent.set(name, entry);
  }

  const to = (agent: AgentName) => tasks.filter((m) => m.to === agent).length;
  const corrections = path.filter((p) => p === "extractor+notes").length;
  const trace: TraceCheck[] = [
    { rule: `messages ≤ ${MAX_AGENT_HOPS}`, ok: stored.hops <= MAX_AGENT_HOPS, detail: String(stored.hops) },
    { rule: `model requests ≤ ${MAX_LLM_CALLS_PER_RUN}`, ok: calls.length <= MAX_LLM_CALLS_PER_RUN, detail: String(calls.length) },
    { rule: "at most one correction round", ok: corrections <= 1, detail: String(corrections) },
    { rule: "deadline agent without model requests", ok: !byAgent.has("deadline"), detail: String(byAgent.get("deadline")?.calls ?? 0) },
  ];
  if (plan === "f2") {
    trace.push({ rule: "intake ran first", ok: path[0] === "intake", detail: path[0] ?? "-" });
    if (!testCase.isOfficialLetter) {
      trace.push({ rule: "no extractor on a letter that is not official", ok: to("extractor") === 0, detail: String(to("extractor")) });
      trace.push({ rule: "no verifier on a letter that is not official", ok: to("verifier") === 0, detail: String(to("verifier")) });
    }
  }

  const extraction: LetterExtraction | undefined = caseFile.extraction;
  const intake = caseFile.intake;
  const intakeChecks: FieldCheck[] = [];
  if (intake) {
    intakeChecks.push({
      field: "intake.isOfficialLetter",
      ok: intake.isOfficialLetter === testCase.isOfficialLetter,
      expected: testCase.isOfficialLetter,
      actual: intake.isOfficialLetter,
    });
    if (testCase.letterType !== undefined) {
      const expected = Array.isArray(testCase.letterType) ? testCase.letterType : [testCase.letterType];
      intakeChecks.push({ field: "intake.letterType", ok: expected.includes(intake.letterType), expected, actual: intake.letterType });
    }
    intakeChecks.push({ field: "intake.language", ok: intake.language === "de", expected: "de", actual: intake.language });
    intakeChecks.push({ field: "intake.scanQuality", ok: intake.scanQuality === "GOOD", expected: "GOOD", actual: intake.scanQuality });
  }

  return {
    file: testCase.file,
    plan,
    official: testCase.isOfficialLetter,
    status: error ? "FAILED" : "DONE",
    error,
    path,
    checks: extraction ? scoreExtraction(testCase, extraction) : [],
    intake: intake && {
      isOfficialLetter: intake.isOfficialLetter,
      letterType: intake.letterType,
      language: intake.language,
      scanQuality: intake.scanQuality,
      model: intake.model,
    },
    intakeChecks,
    hops: stored.hops,
    llmCalls: calls.length,
    costUsd: sum(calls.map((c) => Number(c.costUsd))),
    latencyMs,
    byAgent: [...byAgent.values()],
    trace,
  };
}

const passed = (checks: FieldCheck[]) => checks.filter((c) => c.ok).length;

function summarize(results: RunResult[]) {
  const group = (rs: RunResult[]) => ({
    runs: rs.length,
    failed: rs.filter((r) => r.status === "FAILED").length,
    accuracy: sum(rs.map((r) => passed(r.checks))) / Math.max(1, sum(rs.map((r) => r.checks.length))),
    perfect: rs.filter((r) => r.checks.length > 0 && r.checks.every((c) => c.ok)).length,
    costUsd: sum(rs.map((r) => r.costUsd)),
    costPerLetter: sum(rs.map((r) => r.costUsd)) / Math.max(1, rs.length),
    callsPerLetter: sum(rs.map((r) => r.llmCalls)) / Math.max(1, rs.length),
    latencyPerLetter: sum(rs.map((r) => r.latencyMs)) / Math.max(1, rs.length),
    inputTokens: sum(rs.flatMap((r) => r.byAgent.map((a) => a.inputTokens))),
    outputTokens: sum(rs.flatMap((r) => r.byAgent.map((a) => a.outputTokens))),
  });
  return plans.map((plan) => {
    const ofPlan = results.filter((r) => r.plan === plan);
    return {
      plan,
      official: group(ofPlan.filter((r) => r.official)),
      notOfficial: group(ofPlan.filter((r) => !r.official)),
      all: group(ofPlan),
      traceFailures: ofPlan.flatMap((r) => r.trace.filter((t) => !t.ok).map((t) => ({ file: r.file, ...t }))),
      intakeAccuracy: (() => {
        const checks = ofPlan.flatMap((r) => r.intakeChecks);
        const fields = [...new Set(checks.map((c) => c.field))];
        return fields.map((field) => {
          const of = checks.filter((c) => c.field === field);
          return { field, passed: passed(of), total: of.length };
        });
      })(),
    };
  });
}

function markdownReport(summary: ReturnType<typeof summarize>, results: RunResult[], startedAt: Date): string {
  const columns = summary.map((s) => PLAN_NAMES[s.plan]);
  const row = (label: string, value: (s: (typeof summary)[number]) => string) =>
    `| ${label} | ${summary.map(value).join(" | ")} |`;
  const header = [`| Metric | ${columns.join(" | ")} |`, `|---|${columns.map(() => "---|").join("")}`];

  const lines = [
    `# Evaluation: agent plan of an upload`,
    ``,
    `- Date: ${startedAt.toISOString()}`,
    `- Models: ${llm.model} (intake, extractor), ${verifierLlm?.model ?? "no verifier"} (verifier)`,
    `- Prompts: ${CLASSIFY_LETTER_PROMPT_VERSION}, ${EXTRACT_LETTER_PROMPT_VERSION}`,
    `- Letters: ${cases.length} (${cases.filter((c) => c.isOfficialLetter).length} official), reader language English (no translation)`,
    ``,
    `## Official letters`,
    ``,
    ...header,
    row("Field accuracy", (s) => percent(s.official.accuracy)),
    row("Letters without any error", (s) => `${s.official.perfect} of ${s.official.runs}`),
    row("Failed runs", (s) => String(s.official.failed)),
    row("Model requests per letter", (s) => s.official.callsPerLetter.toFixed(2)),
    row("Cost per letter", (s) => usd(s.official.costPerLetter)),
    row("Latency per letter", (s) => seconds(s.official.latencyPerLetter)),
    ``,
    `## Documents that are not official letters`,
    ``,
    ...header,
    row("Field accuracy", (s) => percent(s.notOfficial.accuracy)),
    row("Model requests per letter", (s) => s.notOfficial.callsPerLetter.toFixed(2)),
    row("Cost per letter", (s) => usd(s.notOfficial.costPerLetter)),
    row("Latency per letter", (s) => seconds(s.notOfficial.latencyPerLetter)),
    row("Tokens (input / output)", (s) => `${s.notOfficial.inputTokens} / ${s.notOfficial.outputTokens}`),
    ``,
    `## All letters`,
    ``,
    ...header,
    row("Cost", (s) => usd(s.all.costUsd)),
    row("Tokens (input / output)", (s) => `${s.all.inputTokens} / ${s.all.outputTokens}`),
    ``,
    `## Trace checks`,
    ``,
  ];
  for (const s of summary) {
    lines.push(
      s.traceFailures.length === 0
        ? `- ${PLAN_NAMES[s.plan]}: all rules held`
        : `- ${PLAN_NAMES[s.plan]}: ${s.traceFailures.map((f) => `**${f.file}** ${f.rule} (${f.detail})`).join("; ")}`,
    );
  }
  const intake = summary.find((s) => s.plan === "f2")?.intakeAccuracy ?? [];
  if (intake.length > 0) {
    lines.push(``, `## Intake decisions`, ``, `| Field | Correct |`, `|---|---|`);
    for (const f of intake) lines.push(`| ${f.field} | ${f.passed}/${f.total} |`);
  }
  lines.push(
    ``,
    `## Runs`,
    ``,
    `| Letter | Plan | Path | Checks | Requests | Cost | Latency |`,
    `|---|---|---|---|---|---|---|`,
    ...results.map(
      (r) =>
        `| ${r.file} | ${r.plan} | ${r.path.join(" → ")}${r.error ? ` (${r.error.slice(0, 80)})` : ""} | ` +
        `${passed(r.checks)}/${r.checks.length} | ${r.llmCalls} | ${usd(r.costUsd)} | ${seconds(r.latencyMs)} |`,
    ),
    ``,
    `## Failed checks`,
    ``,
  );
  for (const r of results) {
    for (const c of [...r.checks, ...r.intakeChecks].filter((check) => !check.ok)) {
      lines.push(`- **${r.file}** (${r.plan}) \`${c.field}\`: expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(c.actual)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = new Date();
  console.log(`Pipeline eval: ${cases.length} letters, plans ${plans.join(", ")}\n`);
  // A guest without e-mail; deleting it and its documents removes the runs and messages of the eval
  const user = await prisma.user.create({ data: { preferredLanguage: "en" } });

  const results: RunResult[] = [];
  try {
    for (const [index, testCase] of cases.entries()) {
      for (const plan of plans) {
        if (index > 0 || plan !== plans[0]) await sleep(Number(args.delay) * 1000);
        const result = await runLetter(testCase, plan, user.id);
        results.push(result);
        const broken = result.trace.filter((t) => !t.ok).map((t) => t.rule);
        console.log(
          `${plan} ${String(passed(result.checks)).padStart(2)}/${String(result.checks.length).padEnd(2)} ` +
            `${result.llmCalls} req ${usd(result.costUsd)} ${seconds(result.latencyMs).padStart(6)}  ${testCase.file}  ` +
            `${result.path.join(" → ")}${result.error ? `\n     ${result.error}` : ""}` +
            (broken.length ? `\n     trace: ${broken.join(", ")}` : ""),
        );
      }
    }
  } finally {
    // Documents first: deleting the user alone would reach each LlmCall row on two paths at once
    await prisma.document.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  const summary = summarize(results);
  const name = `${startedAt.toISOString().replace(/[:.]/g, "-")}-pipeline-${llm.model}`;
  await mkdir(resultsDir, { recursive: true });
  await writeFile(new URL(`${name}.json`, resultsDir), JSON.stringify({ summary, results }, null, 2));
  await writeFile(new URL(`${name}.md`, resultsDir), markdownReport(summary, results, startedAt));
  for (const s of summary) {
    console.log(
      `\n${PLAN_NAMES[s.plan]}: official accuracy ${percent(s.official.accuracy)}, ` +
        `${usd(s.official.costPerLetter)}/official letter, ${usd(s.notOfficial.costPerLetter)}/other document, ` +
        `trace failures ${s.traceFailures.length}`,
    );
  }
  console.log(`\nReport: apps/api/eval-results/${name}.md`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
