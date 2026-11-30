import { z } from "zod";
import type { DeadlineKind } from "./letter";

/**
 * Reminders about letters. Code creates one for every upcoming deadline, users add their own
 * on the reminders page, and the chat can set one when the user asks for it.
 */

export const REMINDER_ORIGINS = ["DEADLINE", "USER", "CHAT"] as const;
export type ReminderOrigin = (typeof REMINDER_ORIGINS)[number];

/** Deadline reminders fire this many days before the due date (or at once if it is closer) */
export const DEADLINE_REMINDER_DAYS_BEFORE = 3;

export const REMINDER_NOTE_MAX_LENGTH = 500;

export interface ReminderDto {
  id: string;
  origin: ReminderOrigin;
  /** YYYY-MM-DD */
  remindOn: string;
  /** The user's own text; empty for deadline reminders, which the web app describes */
  note: string;
  /** Deadline reminders only */
  deadlineKind: DeadlineKind | null;
  dueDate: string | null;
  document: { id: string; originalName: string } | null;
  /** true once the scheduled job fired it */
  due: boolean;
  done: boolean;
  createdAt: string;
}

export interface RemindersDto {
  /** Fired and not done yet, oldest first */
  due: ReminderDto[];
  /** Not fired yet, by date */
  upcoming: ReminderDto[];
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD");

export const CreateReminderSchema = z.object({
  remindOn: isoDate,
  note: z.string().trim().min(1).max(REMINDER_NOTE_MAX_LENGTH),
  documentId: z.string().uuid().nullable().optional(),
});
export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;

export const UpdateReminderSchema = z.object({ done: z.boolean() });
export type UpdateReminderInput = z.infer<typeof UpdateReminderSchema>;
