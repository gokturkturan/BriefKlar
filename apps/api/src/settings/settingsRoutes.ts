import { Router } from "express";
import {
  isExplanationLanguage,
  isGermanState,
  isRetentionPeriod,
  UpdateSettingsSchema,
  type SettingsDto,
} from "@briefklar/shared";
import type { User } from "@prisma/client";
import { recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { getUserId } from "../middleware/demoUser";

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

  // Regional holidays can move due dates, so every analyzed letter is calculated again
  if (before.state !== user.state) {
    const docs = await prisma.document.findMany({
      where: { userId, status: "DONE" },
      select: { id: true },
    });
    for (const doc of docs) await recomputeDeadlines(doc.id);
  }

  res.json(toDto(user));
});
