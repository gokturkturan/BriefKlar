import { env } from "../config/env";
import { GeminiProvider } from "./GeminiProvider";
import type { LLMProvider } from "./LLMProvider";

export const llm: LLMProvider = new GeminiProvider(
  env.GEMINI_API_KEY,
  env.GEMINI_MODEL,
  env.GEMINI_FALLBACK_MODEL || undefined,
);

export { LLMError } from "./errors";
export type { LLMInputPart, LLMProvider } from "./LLMProvider";
