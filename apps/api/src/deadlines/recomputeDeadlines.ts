import { isGermanState, LetterExtractionSchema } from "@briefklar/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { syncDeadlineReminders } from "../reminders/deadlineReminders";
import { todayInGermany } from "./calendarDate";
import { toIsoDate } from "./calendarDate";
import { deadlineRows, type DeadlineContext, type DeadlineRow } from "./deadlineRows";

type Db = Prisma.TransactionClient | typeof prisma;

/** The delivery date and federal state the user entered for this document */
export async function deadlineContext(documentId: string, db: Db = prisma): Promise<DeadlineContext> {
  const doc = await db.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { receivedDate: true, user: { select: { state: true } } },
  });
  return {
    receivedDate: doc.receivedDate ? toIsoDate(doc.receivedDate) : null,
    state: isGermanState(doc.user.state) ? doc.user.state : null,
  };
}

const rowKey = (row: Pick<DeadlineRow, "kind" | "sourceText" | "dueDate" | "isEstimate">) =>
  `${row.kind}|${row.sourceText}|${toIsoDate(row.dueDate)}|${row.isEstimate}`;

/**
 * Calculates the deadlines of an analyzed document again, e.g. after the user entered the
 * delivery date or their federal state. No AI call: the stored extraction is reused.
 * Returns true if any due date changed. Explanations mention due dates, so they are
 * removed when one changes and written again on the next request. Deadline reminders follow
 * the new dates (and are created for letters analyzed before reminders existed).
 */
export async function recomputeDeadlines(documentId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const latest = await tx.extraction.findFirst({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
    const parsed = LetterExtractionSchema.safeParse(latest?.data);
    if (!parsed.success) return false;

    const rows = deadlineRows(documentId, parsed.data, await deadlineContext(documentId, tx));
    const existing = await tx.deadline.findMany({ where: { documentId } });

    await syncDeadlineReminders(tx, documentId, rows, todayInGermany());

    const before = existing.map(rowKey).sort().join("\n");
    const after = rows.map(rowKey).sort().join("\n");
    if (before === after) {
      // Same dates, but the calculation steps may now name the user's state
      for (const row of rows) {
        await tx.deadline.updateMany({
          where: { documentId, kind: row.kind, sourceText: row.sourceText },
          data: { steps: row.steps },
        });
      }
      return false;
    }

    await tx.deadline.deleteMany({ where: { documentId } });
    await tx.deadline.createMany({ data: rows });
    await tx.explanation.deleteMany({ where: { documentId } });
    return true;
  });
}
