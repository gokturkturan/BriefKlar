import { RETENTION_PERIODS, type RetentionPeriod } from "@briefklar/shared";
import type { Prisma } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which letters have passed the retention period their owner chose: one condition per period.
 * Letters still being processed wait for the next run.
 */
export function expiredDocumentsWhere(now: Date): { days: RetentionPeriod; where: Prisma.DocumentWhereInput }[] {
  return RETENTION_PERIODS.map((days) => ({
    days,
    where: {
      user: { retentionDays: days },
      createdAt: { lt: new Date(now.getTime() - days * DAY_MS) },
      status: { not: "PROCESSING" },
    },
  }));
}
