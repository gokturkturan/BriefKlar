import { env, type ProviderName } from "../config/env";
import { ClaudeProvider } from "./ClaudeProvider";
import { GeminiProvider } from "./GeminiProvider";
import type { LLMProvider } from "./LLMProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { ProviderFallback } from "./ProviderFallback";

/** One instance per provider, created on first use, so an unused provider needs no key */
const providers = new Map<ProviderName, LLMProvider>();

export function providerNamed(name: ProviderName): LLMProvider {
  let provider = providers.get(name);
  if (!provider) {
    switch (name) {
      case "gemini":
        provider = new GeminiProvider(
          env.GEMINI_API_KEY,
          env.GEMINI_MODEL,
          env.GEMINI_FALLBACK_MODEL || undefined,
          env.GEMINI_EMBEDDING_MODEL,
        );
        break;
      case "anthropic":
        provider = new ClaudeProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL, env.ANTHROPIC_FALLBACK_MODEL || undefined);
        break;
      case "openai":
        provider = new OpenAIProvider(
          env.OPENAI_API_KEY,
          env.OPENAI_MODEL,
          env.OPENAI_FALLBACK_MODEL || undefined,
          env.OPENAI_EMBEDDING_MODEL,
        );
        break;
    }
    providers.set(name, provider);
  }
  return provider;
}

/** The provider the app uses: LLM_PROVIDER, LLM_FALLBACK_PROVIDER when it is down, LLM_EMBEDDING_PROVIDER for vectors */
export const llm: LLMProvider = new ProviderFallback(
  providerNamed(env.LLM_PROVIDER),
  env.LLM_FALLBACK_PROVIDER && env.LLM_FALLBACK_PROVIDER !== env.LLM_PROVIDER
    ? providerNamed(env.LLM_FALLBACK_PROVIDER)
    : undefined,
  providerNamed(env.LLM_EMBEDDING_PROVIDER),
);

export { LLMError } from "./errors";
export { EMBEDDING_DIMENSIONS, type LLMInputPart, type LLMProvider } from "./LLMProvider";
