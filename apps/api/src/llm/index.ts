import { env } from "../config/env";
import { GeminiProvider } from "./GeminiProvider";
import type { LLMProvider } from "./LLMProvider";

export const llm: LLMProvider = new GeminiProvider(
  env.GEMINI_API_KEY,
  env.GEMINI_MODEL,
  env.GEMINI_FALLBACK_MODEL || undefined,
  env.GEMINI_EMBEDDING_MODEL,
);

export { LLMError } from "./errors";
export { EMBEDDING_DIMENSIONS, type LLMInputPart, type LLMProvider } from "./LLMProvider";
