import { prisma } from "../lib/prisma";
import { LLMError } from "./errors";
import type { FailedAttempt } from "./fallback";
import type { LLMProvider } from "./LLMProvider";

/** Every LLM request is logged to the LlmCall table (tokens, latency, success). */
export async function logCall(data: {
  provider: LLMProvider;
  model: string;
  purpose: string;
  promptVersion: string;
  documentId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await prisma.llmCall.create({
      data: {
        documentId: data.documentId,
        purpose: data.purpose,
        provider: data.provider.name,
        model: data.model,
        promptVersion: data.promptVersion,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costUsd: 0, // free tier for now; a price table per model comes with the cost dashboard
        latencyMs: data.latencyMs,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
  } catch (err) {
    // Logging must never break the actual work
    console.error("Failed to log LLM call:", err);
  }
}

export type CallContext = Pick<Parameters<typeof logCall>[0], "provider" | "purpose" | "promptVersion" | "documentId">;

/**
 * Logs each model that failed before another one answered as its own failed call, so a switch
 * to the fallback model shows up in the log (with the primary's error and wasted time) instead
 * of only the model that answered.
 */
export async function logFailedAttempts(context: CallContext, attempts: FailedAttempt[]) {
  for (const attempt of attempts) {
    await logCall({
      ...context,
      model: attempt.model,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: attempt.latencyMs,
      success: false,
      errorMessage: `${attempt.errorMessage} (switched to the fallback model)`.slice(0, 2000),
    });
  }
}

/** Logs a request that failed: the models that failed first, then the last one */
export async function logFailure(context: CallContext, err: unknown, startedAt: number, errorMessage?: string) {
  const llmError = err instanceof LLMError ? err : undefined;
  await logFailedAttempts(context, llmError?.failedAttempts ?? []);
  await logCall({
    ...context,
    model: llmError?.model ?? context.provider.model,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: llmError?.latencyMs ?? Date.now() - startedAt,
    success: false,
    errorMessage: errorMessage ?? (err instanceof Error ? err.message : String(err)),
  });
}
