import { Router } from "express";
import {
  isExplanationLanguage,
  isGermanState,
  isRetentionPeriod,
  UpdateSettingsSchema,
  type SettingsDto,
} from "@briefklar/shared";
import type { User } from "@prisma/client";
import { afterStateChange } from "../documents/answerQuestion";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { getUserId } from "../auth/requireUser";

export const settingsRouter = Router();

function toDto(user: User): SettingsDto {
  return {
    preferredLanguage: isExplanationLanguage(user.preferredLanguage) ? user.preferredLanguage : "en",
    state: isGermanState(user.state) ? user.state : null,
    retentionDays: isRetentionPeriod(user.retentionDays) ? user.retentionDays : null,
  };
}

// GET /api/settings
settingsRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: getUserId(req) } });
  res.json(toDto(user));
});

// PATCH /api/settings  { preferredLanguage?, state?, retentionDays? }
settingsRouter.patch("/", async (req, res) => {
  const body = UpdateSettingsSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid settings", "INVALID_BODY");

  const userId = getUserId(req);
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const user = await prisma.user.update({ where: { id: userId }, data: body.data });

  // Regional holidays can move due dates, so every analyzed letter is calculated again; a letter
  // whose deadline agent asked for the state goes on with it
  if (before.state !== user.state) await afterStateChange(userId, isGermanState(user.state) ? user.state : null);

  res.json(toDto(user));
});
