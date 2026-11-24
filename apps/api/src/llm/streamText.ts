import { LLMError } from "./errors";
import type { LLMInputPart, LLMProvider, TextGenerationResult } from "./LLMProvider";
import { logCall } from "./logCall";

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

  try {
    const result = await provider.streamText({ system, input, signal }, onDelta);
    await logCall({
      provider, purpose, promptVersion, documentId,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: Date.now() - startedAt,
      success: true,
    });
    return result;
  } catch (err) {
    await logCall({
      provider, purpose, promptVersion, documentId,
      model: err instanceof LLMError && err.model ? err.model : provider.model,
      inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt,
      success: false,
      errorMessage: signal?.aborted ? "Aborted by the client" : err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
