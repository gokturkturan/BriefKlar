import { DEADLINE_REMINDER_DAYS_BEFORE } from "@briefklar/shared";
import type { Prisma } from "@prisma/client";
import { addDays, toIsoDate, type IsoDate } from "../deadlines/calendarDate";
import type { DeadlineRow } from "../deadlines/deadlineRows";

export interface PlannedReminder {
  deadlineKey: string;
  deadlineKind: string;
  dueDate: IsoDate;
  remindOn: IsoDate;
}

/** Identifies a deadline across recalculations: its kind and its wording in the letter */
export const deadlineKey = (row: Pick<DeadlineRow, "kind" | "sourceText">) => `${row.kind}|${row.sourceText}`;

/**
 * One reminder per upcoming deadline, DEADLINE_REMINDER_DAYS_BEFORE days before the due date,
 * or today if that day has already passed. Deadlines that are over get no reminder.
 */
export function planDeadlineReminders(
  rows: Pick<DeadlineRow, "kind" | "sourceText" | "dueDate">[],
  today: IsoDate,
): PlannedReminder[] {
  const planned = new Map<string, PlannedReminder>();
  for (const row of rows) {
    const dueDate = toIsoDate(row.dueDate);
    if (dueDate < today) continue;
    const key = deadlineKey(row);
    const before = addDays(dueDate, -DEADLINE_REMINDER_DAYS_BEFORE);
    const reminder = { deadlineKey: key, deadlineKind: row.kind, dueDate, remindOn: before < today ? today : before };
    // The same wording twice (rare): remind about the earlier date
    const existing = planned.get(key);
    if (!existing || reminder.dueDate < existing.dueDate) planned.set(key, reminder);
  }
  return [...planned.values()];
}

const asDate = (date: IsoDate) => new Date(`${date}T00:00:00Z`);

/**
 * Brings the deadline reminders of a document in line with its deadlines. Called whenever
 * deadlines are written. A reminder whose due date did not change keeps its state, so a
 * reminder the user marked as done stays done after a recalculation.
 */
export async function syncDeadlineReminders(
  tx: Prisma.TransactionClient,
  documentId: string,
  rows: Pick<DeadlineRow, "kind" | "sourceText" | "dueDate">[],
  today: IsoDate,
): Promise<void> {
  const { userId } = await tx.document.findUniqueOrThrow({ where: { id: documentId }, select: { userId: true } });
  const planned = planDeadlineReminders(rows, today);
  const existing = await tx.reminder.findMany({ where: { documentId, origin: "DEADLINE" } });
  const byKey = new Map(existing.map((r) => [r.deadlineKey, r]));

  for (const plan of planned) {
    const current = byKey.get(plan.deadlineKey);
    if (!current) {
      await tx.reminder.create({
        data: {
          userId,
          documentId,
          origin: "DEADLINE",
          deadlineKey: plan.deadlineKey,
          deadlineKind: plan.deadlineKind,
          dueDate: asDate(plan.dueDate),
          remindOn: asDate(plan.remindOn),
        },
      });
    } else if (!current.dueDate || toIsoDate(current.dueDate) !== plan.dueDate) {
      // A new due date is a new reminder: fire it again, even if the old one was done
      await tx.reminder.update({
        where: { id: current.id },
        data: { dueDate: asDate(plan.dueDate), remindOn: asDate(plan.remindOn), firedAt: null, doneAt: null },
      });
    }
  }

  const keep = new Set(planned.map((p) => p.deadlineKey));
  const stale = existing.filter((r) => !r.deadlineKey || !keep.has(r.deadlineKey)).map((r) => r.id);
  if (stale.length > 0) await tx.reminder.deleteMany({ where: { id: { in: stale } } });
}
