import type { LLMInputPart, TextGenerationResult } from "./LLMProvider";
import { loggedCall, type CallContext } from "./logCall";

interface StreamTextOptions extends CallContext {
  system: string;
  input: LLMInputPart[];
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

/** Streams free text from the model and logs the call, like generateStructured does for JSON. */
export function streamText(options: StreamTextOptions): Promise<TextGenerationResult> {
  const { provider, purpose, promptVersion, documentId, system, input, signal, onDelta } = options;
  return loggedCall(
    { provider, purpose, promptVersion, documentId },
    () => provider.streamText({ system, input, signal }, onDelta),
    { signal },
  );
}
