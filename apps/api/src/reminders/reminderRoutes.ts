import { Router } from "express";
import { CreateReminderSchema, UpdateReminderSchema } from "@briefklar/shared";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { getUserId } from "../auth/requireUser";
import { createReminder, listReminders, toReminderDto } from "./reminders";
import { todayInGermany } from "../deadlines/calendarDate";
import { routeParam } from "../documents/ownedDocument";

export const remindersRouter = Router();

// GET /api/reminders  -> { due, upcoming }
remindersRouter.get("/", async (req, res) => {
  res.json(await listReminders(getUserId(req)));
});

// POST /api/reminders  { remindOn, note, documentId? }
remindersRouter.post("/", async (req, res) => {
  const body = CreateReminderSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid reminder", "INVALID_BODY");
  const reminder = await createReminder({
    ...body.data,
    userId: getUserId(req),
    origin: "USER",
    today: todayInGermany(),
  });
  res.status(201).json(reminder);
});

async function findOwnedReminder(userId: string, id: string) {
  const reminder = await prisma.reminder.findFirst({ where: { id, userId } });
  if (!reminder) throw new HttpError(404, "Reminder not found", "REMINDER_NOT_FOUND");
  return reminder;
}

// PATCH /api/reminders/:id  { done }
remindersRouter.patch("/:id", async (req, res) => {
  const body = UpdateReminderSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid reminder", "INVALID_BODY");
  const reminder = await findOwnedReminder(getUserId(req), routeParam(req, "id"));
  const updated = await prisma.reminder.update({
    where: { id: reminder.id },
    data: { doneAt: body.data.done ? new Date() : null },
    include: { document: { select: { id: true, originalName: true } } },
  });
  res.json(toReminderDto(updated));
});

// DELETE /api/reminders/:id
remindersRouter.delete("/:id", async (req, res) => {
  const reminder = await findOwnedReminder(getUserId(req), routeParam(req, "id"));
  await prisma.reminder.delete({ where: { id: reminder.id } });
  res.status(204).end();
});
