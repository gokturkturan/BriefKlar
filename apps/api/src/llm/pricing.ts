/**
 * Prices of the models in US dollars per million tokens, standard rates (see the notes in the
 * table). Thinking tokens are billed as output; the provider already counts them in outputTokens.
 */
export interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const PRICES_CHECKED_ON = "2026-12-12";

const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic, standard rates (Claude Haiku 5.5: prompts up to 100K tokens; a letter is far below)
  "claude-haiku-5-5": { inputPerMillion: 0.1, outputPerMillion: 0.5 },
  "claude-sonnet-5-5": { inputPerMillion: 2, outputPerMillion: 10 },
  // OpenAI, standard tier, short context, from https://developers.openai.com/api/docs/pricing
  "gpt-6-luna": { inputPerMillion: 0.1, outputPerMillion: 0.5 },
  "gpt-6.2-sol": { inputPerMillion: 2, outputPerMillion: 10 },
};

/**
 * The price of a model. Versioned names ("claude-haiku-5-5-20261001", "models/gpt-6-luna")
 * use the price of the longest known name they start with.
 */
export function priceOf(model: string): ModelPrice | undefined {
  const name = model.replace(/^models\//, "");
  if (MODEL_PRICES[name]) return MODEL_PRICES[name];
  const prefix = Object.keys(MODEL_PRICES)
    .filter((known) => name.startsWith(`${known}-`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? MODEL_PRICES[prefix] : undefined;
}

/** Cost of one call in US dollars, or null for a model without a known price */
export function costOf(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = priceOf(model);
  if (!price) return null;
  const cost = (inputTokens * price.inputPerMillion + outputTokens * price.outputPerMillion) / 1_000_000;
  // The column stores six decimal places
  return Math.round(cost * 1_000_000) / 1_000_000;
}
