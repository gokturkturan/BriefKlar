import { z } from "zod";
import type { LLMInputPart, LLMProvider } from "./LLMProvider";
import { loggedCall } from "./logCall";

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

/** The answer as validated data, or what is wrong with it */
function validate<T>(schema: z.ZodType<T>, text: string): { data: T; error?: undefined } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "The response was not valid JSON." };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { data: parsed.data } : { error: z.prettifyError(parsed.error) };
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
    // An LLMError is thrown on: the caller decides whether to retry
    const result = await loggedCall(
      context,
      () => provider.generateJson({ system, input, jsonSchema, timeoutMs: options.timeoutMs }),
      { errorOf: (answer) => validate(schema, answer.text).error },
    );
    usage.inputTokens += result.inputTokens;
    usage.outputTokens += result.outputTokens;
    usage.latencyMs += result.latencyMs;

    const checked = validate(schema, result.text);
    if (checked.error === undefined) {
      return { data: checked.data, model: result.model, attempts: attempt + 1, ...usage };
    }
    lastError = checked.error;

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
