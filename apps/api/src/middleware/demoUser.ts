import type { Request, RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/httpError";

/**
 * Temporary stand-in for authentication: every request belongs to one demo user.
 * Real auth replaces this middleware later; routes already use getUserId().
 */
const DEMO_EMAIL = "demo@briefklar.local";
let demoUserId: string | null = null;

export async function ensureDemoUser(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User" },
  });
  demoUserId = user.id;
}

export const demoUser: RequestHandler = (req, _res, next) => {
  if (demoUserId) req.userId = demoUserId;
  next();
};

export function getUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, "Not authenticated");
  return req.userId;
}
