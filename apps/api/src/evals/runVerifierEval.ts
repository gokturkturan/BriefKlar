import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import type { AgentIssue, LetterExtraction } from "@briefklar/shared";
import { env, type ProviderName } from "../config/env";
import { extractLetter } from "../documents/extractLetter";
import { markUncertain, topLevelField, verifyExtraction } from "../documents/verifyExtraction";
import { prisma } from "../lib/prisma";
import { providerNamed } from "../llm";
import type { StructuredResult } from "../llm/generateStructured";
import { costOf } from "../llm/pricing";
import { EVAL_CASES, type EvalCase } from "./cases";
import { pickCorruptions } from "./corruptions";
import { scoreExtraction, type FieldCheck } from "./score";

/**
 * Measures the verifier agent on the evaluation letters:
 *   npm run eval:verifier -w @briefklar/api
 *   npm run eval:verifier -w @briefklar/api -- --only 01,09 --corruptions 2
 *
 * 1. Pipeline: the extractor analyses each letter, the verifier checks it and, when it finds
 *    errors, the extractor corrects them once and the verifier checks again (as in
 *    agents/analyseLetter.ts). The scores before and after the check show whether the correction
 *    helps or harms, the timings and tokens what the check costs.
 * 2. False alarms: issues reported for a first analysis that passes every check of the case.
 * 3. Broken analyses: deliberate errors put into the first analysis (evals/corruptions.ts); an
 *    error is caught when the verifier names its field.
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
    extractor: { type: "string", default: env.LLM_PROVIDER },
    verifier: { type: "string", default: env.LLM_VERIFIER_PROVIDER || "openai" },
    only: { type: "string" },
    corruptions: { type: "string", default: "3" },
    delay: { type: "string", default: "1" },
  },
});

const extractor = providerNamed(args.extractor as ProviderName);
const verifier = providerNamed(args.verifier as ProviderName);
const lettersDir = new URL("./letters/", import.meta.url);
const resultsDir = new URL("../../eval-results/", import.meta.url);
const prefixes = args.only?.split(",").map((prefix) => prefix.trim());
const cases = EVAL_CASES.filter((c) => !prefixes || prefixes.some((prefix) => c.file.startsWith(prefix)));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

interface Step {
  name: "extract" | "verify" | "revise" | "verify-again";
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface LetterResult {
  file: string;
  steps: Step[];
  firstChecks: FieldCheck[];
  finalChecks: FieldCheck[];
  firstIssues: AgentIssue[];
  finalIssues: AgentIssue[];
  revised: boolean;
  uncertainAdded: string[];
  corruptions: { name: string; field: string; caught: boolean; issues: AgentIssue[]; latencyMs: number }[];
  error?: string;
}

function step(name: Step["name"], result: StructuredResult<unknown>): Step {
  return {
    name,
    model: result.model,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: costOf(result.model, result.inputTokens, result.outputTokens) ?? 0,
  };
}

const passed = (checks: FieldCheck[]) => checks.filter((c) => c.ok).length;

async function runLetter(testCase: EvalCase, index: number): Promise<LetterResult> {
  const mimeType = MIME_TYPES[extname(testCase.file).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported file type: ${testCase.file}`);
  const file = await readFile(new URL(testCase.file, lettersDir));
  const verify = (extraction: LetterExtraction) =>
    verifyExtraction({ provider: verifier, file, mimeType, extraction, purpose: "eval-verify-letter" });

  const steps: Step[] = [];
  const first = await extractLetter({ file, mimeType, provider: extractor, purpose: "eval-extract-letter" });
  steps.push(step("extract", first));
  const check = await verify(first.data);
  steps.push(step("verify", check));

  let final = first.data;
  let finalIssues = check.data.issues;
  if (finalIssues.length > 0) {
    const revised = await extractLetter({
      file,
      mimeType,
      provider: extractor,
      purpose: "eval-revise-letter",
      revision: { previous: first.data, issues: finalIssues },
    });
    steps.push(step("revise", revised));
    const again = await verify(revised.data);
    steps.push(step("verify-again", again));
    finalIssues = again.data.issues;
    final = finalIssues.length > 0 ? markUncertain(revised.data, finalIssues) : revised.data;
  }

  const corruptions = [];
  for (const corruption of pickCorruptions(first.data, Number(args.corruptions), index)) {
    const result = await verify(corruption.apply(first.data));
    corruptions.push({
      name: corruption.name,
      field: corruption.field,
      caught: result.data.issues.some((issue) => topLevelField(issue.field) === corruption.field),
      issues: result.data.issues,
      latencyMs: result.latencyMs,
    });
  }

  return {
    file: testCase.file,
    steps,
    firstChecks: scoreExtraction(testCase, first.data),
    finalChecks: scoreExtraction(testCase, final),
    firstIssues: check.data.issues,
    finalIssues,
    revised: steps.some((s) => s.name === "revise"),
    uncertainAdded: final.uncertainFields.filter((f) => !first.data.uncertainFields.includes(f)),
    corruptions,
  };
}

function summarize(results: LetterResult[]) {
  const ok = results.filter((r) => !r.error);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const stepsOf = (r: LetterResult, names: Step["name"][]) => r.steps.filter((s) => names.includes(s.name));
  const latency = (r: LetterResult, names: Step["name"][]) => sum(stepsOf(r, names).map((s) => s.latencyMs));
  const cost = (r: LetterResult, names: Step["name"][]) => sum(stepsOf(r, names).map((s) => s.costUsd));
  const all: Step["name"][] = ["extract", "verify", "revise", "verify-again"];

  const clean = ok.filter((r) => r.firstChecks.every((c) => c.ok));
  const corruptions = ok.flatMap((r) => r.corruptions);
  const byKind = new Map<string, { caught: number; total: number }>();
  for (const c of corruptions) {
    const entry = byKind.get(c.name) ?? { caught: 0, total: 0 };
    entry.total += 1;
    if (c.caught) entry.caught += 1;
    byKind.set(c.name, entry);
  }

  return {
    letters: results.length,
    failed: results.length - ok.length,
    firstAccuracy: sum(ok.map((r) => passed(r.firstChecks))) / Math.max(1, sum(ok.map((r) => r.firstChecks.length))),
    finalAccuracy: sum(ok.map((r) => passed(r.finalChecks))) / Math.max(1, sum(ok.map((r) => r.finalChecks.length))),
    firstPerfect: ok.filter((r) => r.firstChecks.every((c) => c.ok)).length,
    finalPerfect: ok.filter((r) => r.finalChecks.every((c) => c.ok)).length,
    flagged: ok.filter((r) => r.firstIssues.length > 0).length,
    revised: ok.filter((r) => r.revised).length,
    stillDisputed: ok.filter((r) => r.finalIssues.length > 0).length,
    falseAlarms: clean.filter((r) => r.firstIssues.length > 0).length,
    cleanLetters: clean.length,
    caught: corruptions.filter((c) => c.caught).length,
    corruptions: corruptions.length,
    byKind: [...byKind].map(([name, v]) => ({ name, ...v })),
    medianExtractMs: median(ok.map((r) => latency(r, ["extract"]))),
    medianPipelineMs: median(ok.map((r) => latency(r, all))),
    meanExtractMs: sum(ok.map((r) => latency(r, ["extract"]))) / Math.max(1, ok.length),
    meanPipelineMs: sum(ok.map((r) => latency(r, all))) / Math.max(1, ok.length),
    extractCostUsd: sum(ok.map((r) => cost(r, ["extract"]))),
    pipelineCostUsd: sum(ok.map((r) => cost(r, all))),
    callsPerLetter: sum(ok.map((r) => r.steps.length)) / Math.max(1, ok.length),
  };
}

function markdownReport(summary: ReturnType<typeof summarize>, results: LetterResult[], startedAt: Date): string {
  const s = summary;
  const usd = (value: number) => `$${value.toFixed(4)}`;
  const lines = [
    `# Evaluation: verifier agent`,
    ``,
    `- Date: ${startedAt.toISOString()}`,
    `- Extractor: ${extractor.model}, verifier: ${verifier.model}`,
    `- Letters: ${s.letters}${s.failed ? ` (${s.failed} failed)` : ""}`,
    ``,
    `## Pipeline (extract → verify → at most one correction)`,
    ``,
    `| Metric | Extraction only | With verifier |`,
    `|---|---|---|`,
    `| Field accuracy | ${percent(s.firstAccuracy)} | ${percent(s.finalAccuracy)} |`,
    `| Letters without any error | ${s.firstPerfect} of ${s.letters - s.failed} | ${s.finalPerfect} of ${s.letters - s.failed} |`,
    `| Median latency per letter | ${seconds(s.medianExtractMs)} | ${seconds(s.medianPipelineMs)} |`,
    `| Mean latency per letter | ${seconds(s.meanExtractMs)} | ${seconds(s.meanPipelineMs)} |`,
    `| Cost for all letters | ${usd(s.extractCostUsd)} | ${usd(s.pipelineCostUsd)} |`,
    `| Model requests per letter | 1 | ${s.callsPerLetter.toFixed(2)} |`,
    ``,
    `- Letters the verifier flagged: ${s.flagged}; corrected: ${s.revised}; still disputed after the correction (marked uncertain): ${s.stillDisputed}`,
    `- False alarms on analyses that pass every check: ${s.falseAlarms} of ${s.cleanLetters}`,
    ``,
    `## Broken analyses`,
    ``,
    `Caught ${s.caught} of ${s.corruptions} (${percent(s.caught / Math.max(1, s.corruptions))}).`,
    ``,
    `| Error | Caught |`,
    `|---|---|`,
    ...s.byKind.map((k) => `| ${k.name} | ${k.caught}/${k.total} |`),
    ``,
    `## Letters`,
    ``,
    `| Letter | First | Final | Issues (first → final) | Steps | Latency |`,
    `|---|---|---|---|---|---|`,
    ...results.map((r) =>
      r.error
        ? `| ${r.file} | error | | | | |`
        : `| ${r.file} | ${passed(r.firstChecks)}/${r.firstChecks.length} | ${passed(r.finalChecks)}/${r.finalChecks.length} | ` +
          `${r.firstIssues.length} → ${r.finalIssues.length} | ${r.steps.map((st) => st.name).join(", ")} | ` +
          `${seconds(r.steps.reduce((a, st) => a + st.latencyMs, 0))} |`,
    ),
    ``,
    `## Issues the verifier reported on the first analyses`,
    ``,
  ];
  for (const r of results) {
    if (r.error) lines.push(`- **${r.file}**: ${r.error}`);
    for (const issue of r.firstIssues) {
      lines.push(`- **${r.file}** \`${issue.field}\`: ${issue.problem} — "${issue.evidence}"`);
    }
  }
  lines.push(``, `## Missed errors`, ``);
  for (const r of results) {
    for (const c of r.corruptions.filter((x) => !x.caught)) {
      lines.push(`- **${r.file}** ${c.name}: reported ${c.issues.map((i) => `\`${i.field}\``).join(", ") || "nothing"}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = new Date();
  console.log(`Verifier eval: ${cases.length} letters, extractor ${extractor.model}, verifier ${verifier.model}\n`);

  const results: LetterResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (index > 0) await sleep(Number(args.delay) * 1000);
    let result: LetterResult;
    try {
      result = await runLetter(testCase, index);
    } catch (err) {
      result = {
        file: testCase.file,
        steps: [],
        firstChecks: [],
        finalChecks: [],
        firstIssues: [],
        finalIssues: [],
        revised: false,
        uncertainAdded: [],
        corruptions: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(result);
    console.log(
      result.error
        ? `error    ${testCase.file}\n         ${result.error}`
        : `${passed(result.firstChecks)}/${result.firstChecks.length} → ${passed(result.finalChecks)}/${result.finalChecks.length}  ` +
            `issues ${result.firstIssues.length} → ${result.finalIssues.length}  ` +
            `caught ${result.corruptions.filter((c) => c.caught).length}/${result.corruptions.length}  ${testCase.file}`,
    );
  }

  const summary = summarize(results);
  const name = `${startedAt.toISOString().replace(/[:.]/g, "-")}-verifier-${verifier.model}`;
  await mkdir(resultsDir, { recursive: true });
  await writeFile(new URL(`${name}.json`, resultsDir), JSON.stringify({ summary, results }, null, 2));
  await writeFile(new URL(`${name}.md`, resultsDir), markdownReport(summary, results, startedAt));
  console.log(`\nReport: apps/api/eval-results/${name}.md`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
