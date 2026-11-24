import { prisma } from "../lib/prisma";
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
