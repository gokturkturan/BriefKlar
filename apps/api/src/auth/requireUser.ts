import type { Request, RequestHandler } from "express";
import { HttpError } from "../lib/httpError";
import { findSessionUser } from "./sessions";

/** Sets req.userId when the request has a valid session cookie */
export const loadSession: RequestHandler = async (req, _res, next) => {
  req.userId = (await findSessionUser(req)) ?? undefined;
  next();
};

/** Mounted after the public routes: everything behind it needs a signed-in user */
export const requireUser: RequestHandler = (req, _res, next) => {
  getUserId(req);
  next();
};

export function getUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, "Not authenticated", "NOT_AUTHENTICATED");
  return req.userId;
}
