import { z } from "zod";
import { prisma } from "../lib/prisma";
import { LLMError } from "./errors";
import type { LLMInputPart, LLMProvider } from "./LLMProvider";

interface GenerateStructuredOptions<T> {
  provider: LLMProvider;
  schema: z.ZodType<T>;
  system: string;
  input: LLMInputPart[];
  purpose: string;
  promptVersion: string;
  documentId?: string;
  /** How many times to ask the model to fix an invalid answer */
  maxRepairAttempts?: number;
}

export class LLMValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMValidationError";
  }
}

/** Converts a Zod schema to the JSON Schema we send to the model. */
function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  return jsonSchema;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function logCall(data: {
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

/**
 * Asks the model for JSON, validates it with Zod and, if invalid,
 * sends the validation errors back to the model so it can fix its answer.
 * Every attempt is logged to the LlmCall table (tokens, latency, success).
 */
export interface StructuredResult<T> {
  data: T;
  /** The model that produced the accepted answer */
  model: string;
}

export async function generateStructured<T>(
  options: GenerateStructuredOptions<T>,
): Promise<StructuredResult<T>> {
  const { provider, schema, system, purpose, promptVersion, documentId } = options;
  const maxRepairAttempts = options.maxRepairAttempts ?? 1;
  const jsonSchema = toJsonSchema(schema);

  let input = options.input;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.generateJson({ system, input, jsonSchema });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logCall({
        provider, purpose, promptVersion, documentId,
        model: err instanceof LLMError && err.model ? err.model : provider.model,
        inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt,
        success: false, errorMessage: message,
      });
      throw err; // LLMError: the caller decides whether to retry
    }

    const json = parseJson(result.text);
    const parsed = schema.safeParse(json);
    if (json === undefined) lastError = "The response was not valid JSON.";
    else lastError = parsed.success ? "" : z.prettifyError(parsed.error);

    await logCall({
      provider, model: result.model, purpose, promptVersion, documentId,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: Date.now() - startedAt,
      success: parsed.success,
      errorMessage: parsed.success ? undefined : lastError.slice(0, 2000),
    });

    if (parsed.success) return { data: parsed.data, model: result.model };

    // Repair attempt: show the model its own answer and what was wrong with it
    input = [
      ...options.input,
      {
        type: "text",
        text:
          `Your previous answer did not match the required schema.\n` +
          `Problems:\n${lastError}\n\nPrevious answer:\n${result.text}\n\n` +
          `Return the corrected JSON only.`,
      },
    ];
  }

  throw new LLMValidationError(`Model output failed validation: ${lastError}`);
}
