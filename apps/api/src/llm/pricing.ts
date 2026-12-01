/**
 * Prices of the Gemini models in US dollars per million tokens (paid tier, standard
 * processing, prompts up to 200k tokens), from https://ai.google.dev/gemini-api/docs/pricing.
 *
 * Development runs on the free tier, so these are the costs the same calls would have on the
 * paid tier, which an app for users in the EU has to use. Thinking tokens are billed as output;
 * the provider already counts them in outputTokens.
 *
 * The "-latest" aliases point to whichever model Google released last. Their prices here are
 * those of the model behind the alias when this table was written: update them when it moves.
 */
export interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const PRICES_CHECKED_ON = "2026-12-12";

const MODEL_PRICES: Record<string, ModelPrice> = {
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10 },
  "gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "gemini-2.5-flash-lite": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gemini-3-pro": { inputPerMillion: 2, outputPerMillion: 12 },
  "gemini-3-flash": { inputPerMillion: 0.5, outputPerMillion: 3 },
  "gemini-flash-latest": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "gemini-flash-lite-latest": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gemini-embedding-001": { inputPerMillion: 0.15, outputPerMillion: 0 },
};

/**
 * The price of a model. Versioned names ("gemini-2.5-flash-preview-09-2025",
 * "models/gemini-2.5-flash") use the price of the longest known name they start with.
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
