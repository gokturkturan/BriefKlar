import { Router } from "express";
import { isUsagePeriod } from "@briefklar/shared";
import { getUserId } from "../auth/requireUser";
import { HttpError } from "../lib/httpError";
import { getUsage } from "./usage";

export const usageRouter = Router();

// GET /api/usage?days=30  -> the user's calls, tokens, estimated cost, fallback switches and latency
usageRouter.get("/", async (req, res) => {
  const days = Number(req.query.days ?? 30);
  if (!isUsagePeriod(days)) throw new HttpError(400, "days must be 7, 30 or 90", "INVALID_PARAM");
  res.json(await getUsage(getUserId(req), days));
});
