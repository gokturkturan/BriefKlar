import { z } from "zod";
import { EXPLANATION_LANGUAGES, type ExplanationLanguage } from "./explanation";

/** Accounts: e-mail and password, kept signed in by a session cookie */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;
export const NAME_MAX_LENGTH = 100;

export interface AccountDto {
  email: string;
  name: string | null;
  createdAt: string;
}

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
/** An empty name is stored as null */
const name = z
  .string()
  .trim()
  .max(NAME_MAX_LENGTH)
  .transform((value) => value || null);
const languageCodes = Object.keys(EXPLANATION_LANGUAGES) as [ExplanationLanguage, ...ExplanationLanguage[]];

export const RegisterSchema = z.object({
  email,
  password,
  name: name.optional(),
  /** The language the visitor used before signing up */
  preferredLanguage: z.enum(languageCodes).optional(),
});
export type RegisterInput = z.input<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.input<typeof LoginSchema>;

export const UpdateAccountSchema = z.object({ name });
export type UpdateAccountInput = z.input<typeof UpdateAccountSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: password,
});
export type ChangePasswordInput = z.input<typeof ChangePasswordSchema>;
