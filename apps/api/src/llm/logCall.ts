import { currentAgentScope } from "../agents/agentScope";
import { prisma } from "../lib/prisma";
import { LLMError } from "./errors";
import type { FailedAttempt } from "./fallback";
import type { LLMProvider } from "./LLMProvider";
import { costOf } from "./pricing";

/** What a log row says about the request, apart from the outcome */
export interface CallContext {
  provider: LLMProvider;
  purpose: string;
  promptVersion: string;
  documentId?: string;
}

interface CallOutcome {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

/** Marks a failed call after which the fallback model answered (read by the usage dashboard) */
export const FALLBACK_SWITCH_NOTE = "(switched to the fallback model)";

/**
 * Writes one row to the LlmCall table (tokens, cost, latency, success).
 * The cost comes from the price table; a model without a price is logged with cost 0.
 */
async function logCall(context: CallContext, outcome: CallOutcome) {
  try {
    // Each user sees the cost of their own letters on the usage page
    const owner = context.documentId
      ? await prisma.document.findUnique({ where: { id: context.documentId }, select: { userId: true } })
      : null;
    // Inside an agent run, the request counts towards the run's limit (agents/orchestrator.ts)
    const scope = currentAgentScope();
    const costUsd = costOf(outcome.model, outcome.inputTokens, outcome.outputTokens) ?? 0;
    await prisma.llmCall.create({
      data: {
        documentId: context.documentId,
        userId: owner?.userId,
        purpose: context.purpose,
        provider: context.provider.name,
        promptVersion: context.promptVersion,
        ...outcome,
        errorMessage: outcome.errorMessage?.slice(0, 2000),
        costUsd,
        agentRunId: scope?.runId,
        agent: scope?.agent,
      },
    });
    if (scope) {
      await prisma.agentRun.update({
        where: { id: scope.runId },
        data: { llmCalls: { increment: 1 }, costUsd: { increment: costUsd } },
      });
    }
  } catch (err) {
    // Logging must never break the actual work
    console.error("Failed to log LLM call:", err);
  }
}

/**
 * Each model that failed before another one answered is logged as its own failed call, so a
 * switch to the fallback model shows up in the log (with the primary's error and wasted time).
 */
async function logFailedAttempts(context: CallContext, attempts: FailedAttempt[] = []) {
  for (const attempt of attempts) {
    await logCall(context, {
      model: attempt.model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: attempt.latencyMs,
      success: false,
      // Cut the error, not the note, so a long error still counts as a switch
      errorMessage: `${attempt.errorMessage.slice(0, 1900)} ${FALLBACK_SWITCH_NOTE}`,
    });
  }
}

/** The parts of a provider result that are logged */
export interface LoggableResult {
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  failedAttempts?: FailedAttempt[];
}

/**
 * Runs one model request and logs it: first the models that failed before the answer, then
 * the answer itself, or the failure. `errorOf` can mark an answer as failed, e.g. invalid JSON.
 */
export async function loggedCall<R extends LoggableResult>(
  context: CallContext,
  request: () => Promise<R>,
  options: { signal?: AbortSignal; errorOf?: (result: R) => string | undefined } = {},
): Promise<R> {
  const startedAt = Date.now();
  let result: R;
  try {
    result = await request();
  } catch (err) {
    const llmError = err instanceof LLMError ? err : undefined;
    await logFailedAttempts(context, llmError?.failedAttempts);
    await logCall(context, {
      model: llmError?.model ?? context.provider.model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: llmError?.latencyMs ?? Date.now() - startedAt,
      success: false,
      errorMessage: options.signal?.aborted
        ? "Aborted by the client"
        : err instanceof Error
          ? err.message
          : String(err),
    });
    throw err;
  }

  const errorMessage = options.errorOf?.(result);
  await logFailedAttempts(context, result.failedAttempts);
  await logCall(context, {
    model: result.model,
    inputTokens: result.inputTokens ?? 0,
    outputTokens: result.outputTokens ?? 0,
    latencyMs: result.latencyMs,
    success: errorMessage === undefined,
    errorMessage,
  });
  return result;
}
