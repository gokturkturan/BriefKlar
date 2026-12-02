import { z } from "zod";
import type { LLMInputPart, LLMProvider } from "./LLMProvider";
import { logCall, logFailedAttempts, logFailure } from "./logCall";

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
  /** Longest wait for each answer */
  timeoutMs?: number;
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

/**
 * Asks the model for JSON, validates it with Zod and, if invalid,
 * sends the validation errors back to the model so it can fix its answer.
 * Every attempt is logged to the LlmCall table (tokens, latency, success).
 */
export interface StructuredResult<T> {
  data: T;
  /** The model that produced the accepted answer */
  model: string;
  /** Answers needed: 1 = valid at once, 2 = valid after one repair */
  attempts: number;
  /** Summed over all attempts, for evaluations */
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function generateStructured<T>(
  options: GenerateStructuredOptions<T>,
): Promise<StructuredResult<T>> {
  const { provider, schema, system, purpose, promptVersion, documentId } = options;
  const context = { provider, purpose, promptVersion, documentId };
  const maxRepairAttempts = options.maxRepairAttempts ?? 1;
  const jsonSchema = toJsonSchema(schema);

  let input = options.input;
  let lastError = "";
  const usage = { inputTokens: 0, outputTokens: 0, latencyMs: 0 };

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.generateJson({ system, input, jsonSchema, timeoutMs: options.timeoutMs });
    } catch (err) {
      await logFailure(context, err, startedAt);
      throw err; // LLMError: the caller decides whether to retry
    }

    usage.inputTokens += result.inputTokens;
    usage.outputTokens += result.outputTokens;
    usage.latencyMs += result.latencyMs;

    const json = parseJson(result.text);
    const parsed = schema.safeParse(json);
    if (json === undefined) lastError = "The response was not valid JSON.";
    else lastError = parsed.success ? "" : z.prettifyError(parsed.error);

    await logFailedAttempts(context, result.failedAttempts);
    await logCall({
      ...context,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      success: parsed.success,
      errorMessage: parsed.success ? undefined : lastError.slice(0, 2000),
    });

    if (parsed.success) return { data: parsed.data, model: result.model, attempts: attempt + 1, ...usage };

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
