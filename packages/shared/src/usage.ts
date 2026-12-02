/**
 * Usage and cost of the LLM calls, read from the per-call log (LlmCall). Costs are estimates
 * from the API's price table (paid tier prices), in US dollars.
 */

export const USAGE_PERIODS = [7, 30, 90] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export interface UsageTotalsDto {
  calls: number;
  failedCalls: number;
  /** Failed calls after which the fallback model answered */
  fallbackSwitches: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Average cost of the calls for one letter (analysis, translations, chat...) */
  costPerLetterUsd: number | null;
  letters: number;
  /** Latency of successful calls in milliseconds */
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
}

export interface UsageDayDto {
  /** YYYY-MM-DD, German time */
  date: string;
  calls: number;
  failedCalls: number;
  costUsd: number;
}

export interface UsageGroupDto {
  /** Purpose (extract-letter, chat...) or model name */
  key: string;
  calls: number;
  failedCalls: number;
  fallbackSwitches: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  /** false: no price known for this model, its cost is counted as 0 */
  priced: boolean;
}

export interface UsageFailureDto {
  createdAt: string;
  purpose: string;
  model: string;
  latencyMs: number;
  /** The fallback model answered after this failure */
  switchedToFallback: boolean;
  errorMessage: string | null;
}

export interface UsageDto {
  days: UsagePeriod;
  /** When the price table was last checked, YYYY-MM-DD */
  pricesCheckedOn: string;
  totals: UsageTotalsDto;
  /** Every day of the period, oldest first, also days without calls */
  byDay: UsageDayDto[];
  byPurpose: UsageGroupDto[];
  byModel: UsageGroupDto[];
  recentFailures: UsageFailureDto[];
}

export function isUsagePeriod(value: unknown): value is UsagePeriod {
  return (USAGE_PERIODS as readonly unknown[]).includes(value);
}
