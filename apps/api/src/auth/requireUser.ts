import type { Request, RequestHandler } from "express";
import { HttpError } from "../lib/httpError";
import { findSession } from "./sessions";

/** Sets req.userId (and req.isGuest) when the request has a valid session cookie */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const session = await findSession(req);
  req.userId = session?.userId;
  req.isGuest = session?.isGuest ?? false;
  next();
};

/** Mounted after the public routes: everything behind it needs a session, a guest's is enough */
export const requireUser: RequestHandler = (req, _res, next) => {
  getUserId(req);
  next();
};

/** For the features guests cannot use (explanation, chat, reply drafts, reminders, usage, the account) */
export const requireAccount: RequestHandler = (req, _res, next) => {
  getAccountId(req);
  next();
};

export function getUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, "Not authenticated", "NOT_AUTHENTICATED");
  return req.userId;
}

/** The user id of a signed-in account; guests get a 403 */
export function getAccountId(req: Request): string {
  const userId = getUserId(req);
  if (req.isGuest) throw new HttpError(403, "Sign in or create an account to use this", "ACCOUNT_REQUIRED");
  return userId;
}
