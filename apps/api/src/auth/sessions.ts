import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

/**
 * Server-side sessions: the cookie carries a random token, the database its hash. Signing out
 * or deleting the account ends a session at once, which a stateless token (JWT) could not do.
 */
export const SESSION_COOKIE = "briefklar_session";
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The value of one cookie from the Cookie header */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

/** Starts a session and sets its cookie */
export async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  // Old sessions of this user are cleaned up here instead of in a scheduled job
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    // Not sent with cross-site POST requests, which protects against CSRF
    sameSite: "lax",
    // Production runs behind HTTPS (Caddy); browsers accept secure cookies on http://localhost too
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** The user of a valid session cookie (a guest has no e-mail address), or null */
export async function findSession(req: Request): Promise<{ userId: string; isGuest: boolean } | null> {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { email: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return { userId: session.userId, isGuest: session.user.email === null };
}

/** Ends the session of this request and removes its cookie */
export async function endSession(req: Request, res: Response): Promise<void> {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  clearSessionCookie(res);
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Signs out every other browser, e.g. after a password change */
export async function endOtherSessions(req: Request, userId: string): Promise<void> {
  const token = readCookie(req.headers.cookie, SESSION_COOKIE);
  await prisma.session.deleteMany({
    where: { userId, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) },
  });
}
