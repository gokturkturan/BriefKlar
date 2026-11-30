import {
  DEADLINE_KIND_LABELS,
  type DeadlineKind,
  type ReminderDto,
  type ReminderOrigin,
  type RemindersDto,
} from "@briefklar/shared";
import type { Document, Reminder } from "@prisma/client";
import { isIsoDate, toIsoDate, type IsoDate } from "../deadlines/calendarDate";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";

type ReminderWithDocument = Reminder & { document: Pick<Document, "id" | "originalName"> | null };

const isDeadlineKind = (kind: string | null): kind is DeadlineKind =>
  kind !== null && Object.hasOwn(DEADLINE_KIND_LABELS, kind);

export function toReminderDto(row: ReminderWithDocument): ReminderDto {
  return {
    id: row.id,
    origin: row.origin as ReminderOrigin,
    remindOn: toIsoDate(row.remindOn),
    note: row.note,
    deadlineKind: isDeadlineKind(row.deadlineKind) ? row.deadlineKind : null,
    dueDate: row.dueDate ? toIsoDate(row.dueDate) : null,
    document: row.document,
    due: row.firedAt !== null,
    done: row.doneAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

const withDocument = { document: { select: { id: true, originalName: true } } } as const;

/** Open reminders of a user (or of one letter): fired ones first, then the upcoming ones */
export async function listReminders(userId: string, documentId?: string): Promise<RemindersDto> {
  const rows = await prisma.reminder.findMany({
    where: { userId, doneAt: null, ...(documentId ? { documentId } : {}) },
    include: withDocument,
    orderBy: [{ remindOn: "asc" }, { createdAt: "asc" }],
  });
  const dtos = rows.map(toReminderDto);
  return { due: dtos.filter((r) => r.due), upcoming: dtos.filter((r) => !r.due) };
}

/** A reminder written by the user, on the reminders page or through the chat */
export async function createReminder(input: {
  userId: string;
  origin: Exclude<ReminderOrigin, "DEADLINE">;
  remindOn: IsoDate;
  note: string;
  documentId?: string | null;
  today: IsoDate;
}): Promise<ReminderDto> {
  if (!isIsoDate(input.remindOn)) throw new HttpError(400, "Invalid date", "INVALID_DATE");
  if (input.remindOn < input.today) throw new HttpError(400, "The reminder date is in the past", "DATE_IN_PAST");

  if (input.documentId) {
    const owned = await prisma.document.count({ where: { id: input.documentId, userId: input.userId } });
    if (owned === 0) throw new HttpError(404, "Document not found", "DOCUMENT_NOT_FOUND");
  }

  const row = await prisma.reminder.create({
    data: {
      userId: input.userId,
      documentId: input.documentId ?? null,
      origin: input.origin,
      remindOn: new Date(`${input.remindOn}T00:00:00Z`),
      note: input.note.trim(),
    },
    include: withDocument,
  });
  return toReminderDto(row);
}

/**
 * Fires every reminder whose day has come. Run by the worker on a schedule. Today it marks
 * them as due, so the web app shows them; this is where an e-mail or push message would be
 * sent once users have addresses (week 6, with real accounts).
 */
export async function fireDueReminders(today: IsoDate, now = new Date()): Promise<number> {
  const { count } = await prisma.reminder.updateMany({
    where: { firedAt: null, doneAt: null, remindOn: { lte: new Date(`${today}T00:00:00Z`) } },
    data: { firedAt: now },
  });
  return count;
}
