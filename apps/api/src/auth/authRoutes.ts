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
import { loginAttempts } from "./loginAttempts";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import { getUserId } from "./requireUser";
import { endOtherSessions, endSession, startSession } from "./sessions";

export const authRouter = Router();

function toDto(user: User): AccountDto {
  return { email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
}

// POST /api/auth/register  { email, password, name?, preferredLanguage? }  -> signed in
authRouter.post("/register", async (req, res) => {
  const body = RegisterSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid e-mail or password", "INVALID_BODY");
  const { password, ...data } = body.data;
  const taken = () => new HttpError(409, "This e-mail address is already registered", "EMAIL_TAKEN");
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw taken();

  let user: User;
  try {
    user = await prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
  } catch (err) {
    // Two sign-ups with the same address at the same moment
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw taken();
    throw err;
  }
  await startSession(res, user.id);
  res.status(201).json(toDto(user));
});

// POST /api/auth/login  { email, password }  -> signed in
authRouter.post("/login", async (req, res) => {
  const body = LoginSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid e-mail or password", "INVALID_BODY");
  const { email, password } = body.data;
  if (loginAttempts.isBlocked(email)) {
    throw new HttpError(429, "Too many failed sign-ins. Try again later.", "TOO_MANY_ATTEMPTS");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Unknown e-mail and wrong password look the same, also in the time the answer takes
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) {
    loginAttempts.recordFailure(email);
    throw new HttpError(401, "Wrong e-mail or password", "INVALID_CREDENTIALS");
  }

  loginAttempts.reset(email);
  await startSession(res, user.id);
  res.json(toDto(user));
});

// POST /api/auth/logout
authRouter.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

// GET /api/auth/me  -> the signed-in account, or 401
authRouter.get("/me", async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: getUserId(req) } });
  res.json(toDto(user));
});

// PATCH /api/auth/me  { name }
authRouter.patch("/me", async (req, res) => {
  const body = UpdateAccountSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid name", "INVALID_BODY");
  const user = await prisma.user.update({ where: { id: getUserId(req) }, data: body.data });
  res.json(toDto(user));
});

// POST /api/auth/password  { currentPassword, newPassword }  -> other browsers are signed out
authRouter.post("/password", async (req, res) => {
  const body = ChangePasswordSchema.safeParse(req.body);
  if (!body.success) throw new HttpError(400, "Invalid password", "INVALID_BODY");
  const userId = getUserId(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash || !(await verifyPassword(body.data.currentPassword, user.passwordHash))) {
    throw new HttpError(400, "The current password is wrong", "INVALID_CREDENTIALS");
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(body.data.newPassword) } });
  await endOtherSessions(req, userId);
  res.status(204).end();
});
