import type { LLMInputPart, LLMProvider, TextGenerationResult } from "./LLMProvider";
import { logCall, logFailedAttempts, logFailure } from "./logCall";

interface StreamTextOptions {
  provider: LLMProvider;
  system: string;
  input: LLMInputPart[];
  purpose: string;
  promptVersion: string;
  documentId?: string;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

/** Streams free text from the model and logs the call, like generateStructured does for JSON. */
export async function streamText(options: StreamTextOptions): Promise<TextGenerationResult> {
  const { provider, system, input, purpose, promptVersion, documentId, signal, onDelta } = options;
  const startedAt = Date.now();
  const context = { provider, purpose, promptVersion, documentId };

  try {
    const result = await provider.streamText({ system, input, signal }, onDelta);
    await logFailedAttempts(context, result.failedAttempts);
    await logCall({
      ...context,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      success: true,
    });
    return result;
  } catch (err) {
    await logFailure(context, err, startedAt, signal?.aborted ? "Aborted by the client" : undefined);
    throw err;
  }
}
