import { Prisma } from "@prisma/client";
import type { UsageDayDto, UsageDto, UsageGroupDto, UsagePeriod } from "@briefklar/shared";
import { addDays, todayInGermany, type IsoDate } from "../deadlines/calendarDate";
import { prisma } from "../lib/prisma";
import { FALLBACK_SWITCH_NOTE } from "../llm/logCall";
import { PRICES_CHECKED_ON, priceOf } from "../llm/pricing";

/** Days are counted in German time, like deadlines and reminders */
const BERLIN_DAY = Prisma.sql`to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD')`;
const IS_SWITCH = Prisma.sql`(NOT success AND "errorMessage" LIKE ${`%${FALLBACK_SWITCH_NOTE}`})`;

/** Raw SQL returns bigint for counts and Decimal for sums */
const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
const latency = (value: unknown): number | null => (value === null || value === undefined ? null : Math.round(Number(value)));

interface GroupRow {
  key: string;
  calls: bigint;
  failed: bigint;
  switches: bigint;
  input: bigint | null;
  output: bigint | null;
  cost: Prisma.Decimal | null;
  p50: number | null;
  p95: number | null;
}

/** First day of the period: today and the days before it, `days` days in all */
export function periodStart(today: IsoDate, days: number): IsoDate {
  return addDays(today, -(days - 1));
}

/** Every day from start to today, with zeros for days without calls */
export function fillDays(start: IsoDate, today: IsoDate, rows: UsageDayDto[]): UsageDayDto[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const days: UsageDayDto[] = [];
  for (let date = start; date <= today; date = addDays(date, 1)) {
    days.push(byDate.get(date) ?? { date, calls: 0, failedCalls: 0, costUsd: 0 });
  }
  return days;
}

function toGroup(row: GroupRow, priced: boolean): UsageGroupDto {
  return {
    key: row.key,
    calls: num(row.calls),
    failedCalls: num(row.failed),
    fallbackSwitches: num(row.switches),
    inputTokens: num(row.input),
    outputTokens: num(row.output),
    costUsd: num(row.cost),
    p50LatencyMs: latency(row.p50),
    p95LatencyMs: latency(row.p95),
    priced,
  };
}

function groupBy(column: Prisma.Sql, where: Prisma.Sql) {
  return prisma.$queryRaw<GroupRow[]>`
    SELECT ${column} AS key,
           count(*) AS calls,
           count(*) FILTER (WHERE NOT success) AS failed,
           count(*) FILTER (WHERE ${IS_SWITCH}) AS switches,
           sum("inputTokens") AS input,
           sum("outputTokens") AS output,
           sum("costUsd") AS cost,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "latencyMs") FILTER (WHERE success) AS p50,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY "latencyMs") FILTER (WHERE success) AS p95
    FROM "LlmCall"
    WHERE ${where}
    GROUP BY 1
    ORDER BY sum("costUsd") DESC, count(*) DESC`;
}

/**
 * Usage of the LLM over the last `days` days (German time, today included): totals, a row
 * per day, per purpose and per model, and the latest failures. All calls of the app are
 * counted; once there are real accounts this belongs behind an admin role.
 */
export async function getUsage(days: UsagePeriod, today: IsoDate = todayInGermany()): Promise<UsageDto> {
  const start = periodStart(today, days);
  const where = Prisma.sql`${BERLIN_DAY} >= ${start}`;

  const [totals, letters, dayRows, byPurpose, byModel, failures] = await Promise.all([
    prisma.$queryRaw<[GroupRow]>`
      SELECT 'all' AS key,
             count(*) AS calls,
             count(*) FILTER (WHERE NOT success) AS failed,
             count(*) FILTER (WHERE ${IS_SWITCH}) AS switches,
             sum("inputTokens") AS input,
             sum("outputTokens") AS output,
             sum("costUsd") AS cost,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY "latencyMs") FILTER (WHERE success) AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY "latencyMs") FILTER (WHERE success) AS p95
      FROM "LlmCall"
      WHERE ${where}`,
    prisma.$queryRaw<[{ letters: bigint; cost: Prisma.Decimal | null }]>`
      SELECT count(DISTINCT "documentId") AS letters, sum("costUsd") AS cost
      FROM "LlmCall"
      WHERE ${where} AND "documentId" IS NOT NULL`,
    prisma.$queryRaw<{ date: string; calls: bigint; failed: bigint; cost: Prisma.Decimal | null }[]>`
      SELECT ${BERLIN_DAY} AS date,
             count(*) AS calls,
             count(*) FILTER (WHERE NOT success) AS failed,
             sum("costUsd") AS cost
      FROM "LlmCall"
      WHERE ${where}
      GROUP BY 1`,
    groupBy(Prisma.sql`purpose`, where),
    groupBy(Prisma.sql`model`, where),
    prisma.llmCall.findMany({
      where: { success: false, createdAt: { gte: new Date(`${addDays(start, -1)}T00:00:00Z`) } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { createdAt: true, purpose: true, model: true, latencyMs: true, errorMessage: true },
    }),
  ]);

  const total = totals[0];
  const letterCount = num(letters[0].letters);

  return {
    days,
    pricesCheckedOn: PRICES_CHECKED_ON,
    totals: {
      calls: num(total.calls),
      failedCalls: num(total.failed),
      fallbackSwitches: num(total.switches),
      inputTokens: num(total.input),
      outputTokens: num(total.output),
      costUsd: num(total.cost),
      letters: letterCount,
      costPerLetterUsd: letterCount > 0 ? num(letters[0].cost) / letterCount : null,
      p50LatencyMs: latency(total.p50),
      p95LatencyMs: latency(total.p95),
    },
    byDay: fillDays(
      start,
      today,
      dayRows.map((row) => ({ date: row.date, calls: num(row.calls), failedCalls: num(row.failed), costUsd: num(row.cost) })),
    ),
    byPurpose: byPurpose.map((row) => toGroup(row, true)),
    byModel: byModel.map((row) => toGroup(row, priceOf(row.key) !== undefined)),
    recentFailures: failures.map((call) => ({
      createdAt: call.createdAt.toISOString(),
      purpose: call.purpose,
      model: call.model,
      latencyMs: call.latencyMs,
      switchedToFallback: call.errorMessage?.endsWith(FALLBACK_SWITCH_NOTE) ?? false,
      errorMessage: call.errorMessage,
    })),
  };
}
