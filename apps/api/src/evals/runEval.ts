import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { LLMError } from "../llm/errors";
import { extractLetter } from "../documents/extractLetter";
import { ClaudeProvider } from "../llm/ClaudeProvider";
import { GeminiProvider } from "../llm/GeminiProvider";
import type { LLMProvider } from "../llm/LLMProvider";
import { OpenAIProvider } from "../llm/OpenAIProvider";
import { LLMValidationError } from "../llm/generateStructured";
import { costOf } from "../llm/pricing";
import { EXTRACT_LETTER_PROMPT_VERSION } from "../documents/extractLetter";
import { EVAL_CASES, type EvalCase } from "./cases";
import { scoreExtraction, summarize, type CaseResult, type EvalSummary } from "./score";

/**
 * Runs the letter analysis over the evaluation set and scores it:
 *   npm run eval -w @briefklar/api
 *   npm run eval -w @briefklar/api -- --model gemini-flash-lite-latest
 *   npm run eval -w @briefklar/api -- --provider anthropic
 *   npm run eval -w @briefklar/api -- --provider openai --model gpt-6-luna
 *   npm run eval -w @briefklar/api -- --with-fallback --only 01,09
 *
 * By default one model answers everything (no fallback), so the result belongs to that model.
 * --with-fallback runs the production setup and shows which model answered each letter.
 * Calls are logged as "eval-extract-letter", so they show up in the usage dashboard.
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
    provider: { type: "string", default: env.LLM_PROVIDER },
    model: { type: "string" },
    "with-fallback": { type: "boolean", default: false },
    only: { type: "string" },
    // Pause between letters, so the free tier's requests-per-minute limit is not hit
    delay: { type: "string", default: "4" },
  },
});

/** The provider under test, with one model (and its fallback model with --with-fallback) */
function evalProvider(name: string): { provider: LLMProvider; model: string; fallbackModel?: string } {
  const withFallback = args["with-fallback"];
  switch (name) {
    case "gemini": {
      const model = args.model ?? env.GEMINI_MODEL;
      const fallbackModel = withFallback ? env.GEMINI_FALLBACK_MODEL || undefined : undefined;
      return { provider: new GeminiProvider(env.GEMINI_API_KEY, model, fallbackModel), model, fallbackModel };
    }
    case "anthropic": {
      const model = args.model ?? env.ANTHROPIC_MODEL;
      const fallbackModel = withFallback ? env.ANTHROPIC_FALLBACK_MODEL || undefined : undefined;
      return { provider: new ClaudeProvider(
          env.ANTHROPIC_API_KEY,
          model,
          fallbackModel,
          env.ANTHROPIC_WORKSPACE_ID || undefined,
        ), model, fallbackModel };
    }
    case "openai": {
      const model = args.model ?? env.OPENAI_MODEL;
      const fallbackModel = withFallback ? env.OPENAI_FALLBACK_MODEL || undefined : undefined;
      return { provider: new OpenAIProvider(env.OPENAI_API_KEY, model, fallbackModel), model, fallbackModel };
    }
    default:
      throw new Error(`Unknown provider "${name}": use gemini, anthropic or openai`);
  }
}

const { provider, model, fallbackModel } = evalProvider(args.provider ?? env.LLM_PROVIDER);
const lettersDir = new URL("./letters/", import.meta.url);
const resultsDir = new URL("../../eval-results/", import.meta.url);

const prefixes = args.only?.split(",").map((prefix) => prefix.trim());
const cases = EVAL_CASES.filter((c) => !prefixes || prefixes.some((prefix) => c.file.startsWith(prefix)));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
/** Lists in the report one item per line, so each deadline's kind and wording can be read */
const show = (value: unknown): string =>
  Array.isArray(value) && value.length > 0
    ? value.map((item) => `\n  - ${typeof item === "string" ? item : JSON.stringify(item)}`).join("")
    : JSON.stringify(value);
const seconds = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);

async function runCase(testCase: EvalCase): Promise<CaseResult> {
  const mimeType = MIME_TYPES[extname(testCase.file).toLowerCase()];
  if (!mimeType) throw new Error(`Unsupported file type: ${testCase.file}`);
  const file = await readFile(new URL(testCase.file, lettersDir));
  const startedAt = Date.now();

  try {
    const result = await extractLetter({ file, mimeType, provider, purpose: "eval-extract-letter" });
    return {
      file: testCase.file,
      outcome: result.attempts === 1 ? "valid" : "repaired",
      model: result.model,
      checks: scoreExtraction(testCase, result.data),
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: costOf(result.model, result.inputTokens, result.outputTokens),
    };
  } catch (err) {
    // Anything else (a missing file, a database error) is a bug in the run, not a result
    if (!(err instanceof LLMError) && !(err instanceof LLMValidationError)) throw err;
    // A wrong key or model name would fail every letter the same way
    if (err instanceof LLMError && (err.code === "AI_KEY_REJECTED" || err.code === "AI_MODEL_NOT_FOUND")) throw err;
    return {
      file: testCase.file,
      outcome: err instanceof LLMValidationError ? "invalid" : "error",
      model: err instanceof LLMError ? err.model ?? null : null,
      checks: [],
      latencyMs: Date.now() - startedAt,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      error: err.message,
    };
  }
}

function markdownReport(summary: EvalSummary, results: CaseResult[], startedAt: Date): string {
  const { outcomes } = summary;
  const lines = [
    `# Evaluation: letter analysis`,
    ``,
    `- Date: ${startedAt.toISOString()}`,
    `- Model: ${model}${fallbackModel ? ` (fallback: ${fallbackModel})` : " (no fallback)"}`,
    `- Prompt version: ${EXTRACT_LETTER_PROMPT_VERSION}`,
    `- Letters: ${summary.cases}`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Schema conformance | ${percent(summary.schemaConformance)} (valid at once ${outcomes.valid}, after repair ${outcomes.repaired}, invalid ${outcomes.invalid}, no answer ${outcomes.error}) |`,
    `| Field accuracy | ${percent(summary.fieldAccuracy)} |`,
    `| Letters without any error | ${summary.perfectCases} of ${summary.cases} |`,
    `| Median latency | ${seconds(summary.medianLatencyMs)} |`,
    `| Tokens (input / output) | ${summary.inputTokens} / ${summary.outputTokens} |`,
    `| Estimated cost | ${summary.costUsd === null ? "unknown" : `$${summary.costUsd.toFixed(4)}`} |`,
    ``,
    `## Accuracy per field`,
    ``,
    `| Field | Passed | Accuracy |`,
    `|---|---|---|`,
    ...summary.byField.map((f) => `| ${f.field} | ${f.passed}/${f.total} | ${percent(f.accuracy)} |`),
    ``,
    `## Letters`,
    ``,
    `| Letter | Outcome | Model | Checks | Latency |`,
    `|---|---|---|---|---|`,
    ...results.map(
      (r) =>
        `| ${r.file} | ${r.outcome} | ${r.model ?? "–"} | ${r.checks.filter((c) => c.ok).length}/${r.checks.length} | ${seconds(r.latencyMs)} |`,
    ),
    ``,
    `## Failed checks`,
    ``,
  ];
  for (const r of results) {
    if (r.error) lines.push(`- **${r.file}**: ${r.error}`);
    for (const c of r.checks.filter((check) => !check.ok)) {
      lines.push(`- **${r.file}** \`${c.field}\`: expected ${show(c.expected)}, got ${show(c.actual)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = new Date();
  console.log(`Evaluating ${cases.length} letters with ${model}${fallbackModel ? ` (fallback ${fallbackModel})` : ""}\n`);

  const results: CaseResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (index > 0) await sleep(Number(args.delay) * 1000);
    const result = await runCase(testCase);
    results.push(result);
    const passed = result.checks.filter((c) => c.ok).length;
    console.log(
      `${result.outcome.padEnd(8)} ${String(passed).padStart(2)}/${String(result.checks.length).padEnd(2)} ` +
        `${seconds(result.latencyMs).padStart(7)}  ${result.model ?? "-"}  ${testCase.file}` +
        (result.error ? `\n         ${result.error}` : ""),
    );
  }

  const summary = summarize(results);
  const name = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${model}`;
  await mkdir(resultsDir, { recursive: true });
  await writeFile(
    new URL(`${name}.json`, resultsDir),
    JSON.stringify({ model, fallbackModel, promptVersion: EXTRACT_LETTER_PROMPT_VERSION, summary, results }, null, 2),
  );
  await writeFile(new URL(`${name}.md`, resultsDir), markdownReport(summary, results, startedAt));

  console.log(`\nSchema conformance ${percent(summary.schemaConformance)}, field accuracy ${percent(summary.fieldAccuracy)}`);
  for (const field of summary.byField) console.log(`  ${field.field.padEnd(22)} ${field.passed}/${field.total}`);
  console.log(`\nReport: apps/api/eval-results/${name}.md`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
