import { Router } from "express";
import {
  ChangePasswordSchema,
  LoginSchema,
  RegisterSchema,
  UpdateAccountSchema,
  type AccountDto,
} from "@briefklar/shared";
import { Prisma, type User } from "@prisma/client";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { moveUserData } from "./moveUserData";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import { failedLogins, guestStarts } from "./rateLimit";
import { getAccountId, getUserId } from "./requireUser";
import { endOtherSessions, endSession, startSession } from "./sessions";

export const authRouter = Router();

function toDto(user: User): AccountDto {
  return { email: user.email, name: user.name, guest: user.email === null, createdAt: user.createdAt.toISOString() };
}

const GuestSchema = RegisterSchema.pick({ preferredLanguage: true });

// POST /api/auth/guest  { preferredLanguage? }  -> a guest session, to try BriefKlar without an account
authRouter.post("/guest", async (req, res) => {
  if (req.userId) {
    res.json(toDto(await prisma.user.findUniqueOrThrow({ where: { id: req.userId } })));
    return;
  }
  const ip = req.ip ?? "unknown";
  if (guestStarts.isBlocked(ip)) {
    throw new HttpError(429, "Too many guest sessions. Try again later.", "TOO_MANY_ATTEMPTS");
  }
  guestStarts.record(ip);

  const body = GuestSchema.safeParse(req.body ?? {});
  const user = await prisma.user.create({ data: body.success ? body.data : {} });
  await startSession(res, user.id);
  res.status(201).json(toDto(user));
});

// POST /api/auth/register  { email, password, name?, preferredLanguage? }  -> signed in.
// A guest keeps their letters: the guest becomes the account.
authRouter.post("/register", async (req, res) => {
  const body = RegisterSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid e-mail or password", "INVALID_BODY");
  const { password, ...data } = body.data;
  const taken = () => new HttpError(409, "This e-mail address is already registered", "EMAIL_TAKEN");
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw taken();

  const fields = { ...data, passwordHash: await hashPassword(password) };
  let user: User;
  try {
    user =
      req.userId && req.isGuest
        ? await prisma.user.update({ where: { id: req.userId }, data: fields })
        : await prisma.user.create({ data: fields });
  } catch (err) {
    // Two sign-ups with the same address at the same moment
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw taken();
    throw err;
  }
  await startSession(res, user.id);
  res.status(201).json(toDto(user));
});

// POST /api/auth/login  { email, password }  -> signed in. A guest's letters move to the account.
authRouter.post("/login", async (req, res) => {
  const body = LoginSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid e-mail or password", "INVALID_BODY");
  const { email, password } = body.data;
  if (failedLogins.isBlocked(email)) {
    throw new HttpError(429, "Too many failed sign-ins. Try again later.", "TOO_MANY_ATTEMPTS");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Unknown e-mail and wrong password look the same, also in the time the answer takes
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) {
    failedLogins.record(email);
    throw new HttpError(401, "Wrong e-mail or password", "INVALID_CREDENTIALS");
  }
  failedLogins.reset(email);

  if (req.userId && req.isGuest) {
    const guest = await prisma.user.findUnique({ where: { id: req.userId } });
    if (guest) await moveUserData(guest, user); // also ends the guest session
  }
  await startSession(res, user.id);
  res.json(toDto(user));
});

// POST /api/auth/logout
authRouter.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

// GET /api/auth/me  -> the signed-in account or guest, or 401
authRouter.get("/me", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: getUserId(req) } });
  res.json(toDto(user));
});

// PATCH /api/auth/me  { name }
authRouter.patch("/me", async (req, res) => {
  const body = UpdateAccountSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid name", "INVALID_BODY");
  const user = await prisma.user.update({ where: { id: getAccountId(req) }, data: body.data });
  res.json(toDto(user));
});

// POST /api/auth/password  { currentPassword, newPassword }  -> other browsers are signed out
authRouter.post("/password", async (req, res) => {
  const body = ChangePasswordSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid password", "INVALID_BODY");
  const userId = getAccountId(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verifyPassword(body.data.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "The current password is wrong", "INVALID_CREDENTIALS");
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(body.data.newPassword) } });
  await endOtherSessions(req, userId);
  res.status(204).end();
});
