import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { ensureDemoUser, getUserId } from "../middleware/demoUser";
import { deleteUserData, exportUserData } from "./userData";
import { todayInGermany } from "../deadlines/calendarDate";

export const accountRouter = Router();

// GET /api/account/export  -> all of the user's data as a JSON file (GDPR Art. 15 and 20)
accountRouter.get("/export", async (req, res) => {
  const data = await exportUserData(getUserId(req));
  res.setHeader("Content-Disposition", `attachment; filename="briefklar-export-${todayInGermany()}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.json(data);
});

/** The client must send this, so the account is never deleted by a stray request */
const DeleteAccountSchema = z.object({ confirm: z.literal("DELETE") });

// DELETE /api/account  { confirm: "DELETE" }  -> deletes every letter, file and setting (Art. 17)
accountRouter.delete("/", async (req, res) => {
  if (!DeleteAccountSchema.safeParse(req.body).success) {
    throw new HttpError(400, 'Send { "confirm": "DELETE" } to delete the account', "INVALID_BODY");
  }
  const userId = getUserId(req);
  const processing = await prisma.document.count({ where: { userId, status: "PROCESSING" } });
  if (processing > 0) {
    throw new HttpError(409, "A letter is being processed. Try again in a moment.", "ALREADY_PROCESSING");
  }

  await deleteUserData(userId);
  // Until there are real accounts, the app keeps working with a new, empty demo user
  await ensureDemoUser();
  res.status(204).end();
});
