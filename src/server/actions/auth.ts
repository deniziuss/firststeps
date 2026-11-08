"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActionI18n } from "@/i18n/server";
import { fieldErrors, passwordChangeSchema, profileSchema, registerSchema, signInSchema } from "@/lib/validation";
import { HOME_BY_ROLE, requireUser } from "../dal";
import { isUniqueViolation, type ActionResult } from "../errors";
import { hashPassword, verifyPassword } from "../password";
import { resetTokens, takeToken } from "../rateLimit";
import * as users from "../repositories/users";
import { createSession, deleteSession } from "../session";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// X-Forwarded-For can be set by any client, so it is only used behind a proxy that overwrites it.
async function clientKey(scope: string, email: string) {
  const forwarded = process.env.TRUST_PROXY === "true" ? (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  return `${scope}:${forwarded ?? "direct"}:${email}`;
}

export async function register(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { t, has } = await getActionI18n();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };

  const { firstName, lastName, email, password } = parsed.data;
  const allowed = takeToken(await clientKey("register", email), 5, FIFTEEN_MINUTES) && takeToken(await clientKey("register", "*"), 30, FIFTEEN_MINUTES);
  if (!allowed) return { ok: false, error: t("auth.tooManyAttempts") };

  let userId: number;
  try {
    userId = await users.createStudent({ firstName, lastName, email, passwordHash: await hashPassword(password) });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: t("auth.emailTaken"), fieldErrors: { email: [t("auth.emailTaken")] } };
    throw error;
  }
  await createSession(userId);
  redirect("/onboarding");
}

export async function signIn(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { t, has } = await getActionI18n();
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("auth.enterCredentials"), fieldErrors: fieldErrors(parsed.error, t, has) };

  const { email, password } = parsed.data;
  const key = await clientKey("sign-in", email);
  if (!takeToken(key, 5, FIFTEEN_MINUTES)) return { ok: false, error: t("auth.tooManyAttempts") };

  const account = await users.findCredentialsByEmail(email);
  // Same message and similar timing for unknown email, wrong password and inactive account.
  const valid = account ? await verifyPassword(account.PasswordHash, password) : (await hashPassword(password), false);
  if (!account || !valid || !account.IsActive) return { ok: false, error: t("auth.wrongCredentials") };

  resetTokens(key);
  await createSession(account.UserID);
  const user = await users.findUserById(account.UserID);
  redirect(HOME_BY_ROLE[user!.UserRole]);
}

export async function signOut() {
  await deleteSession();
  redirect("/sign-in");
}

export async function updateProfile(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { t, has } = await getActionI18n();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };
  await users.updateProfile(user.id, parsed.data.firstName, parsed.data.lastName);
  return { ok: true, message: t("settings.profileSaved") };
}

export async function changePassword(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const { t, has } = await getActionI18n();
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };

  const key = await clientKey("password", String(user.id));
  if (!takeToken(key, 5, FIFTEEN_MINUTES)) return { ok: false, error: t("auth.tooManyAttempts") };

  const stored = await users.findPasswordHash(user.id);
  if (!stored || !(await verifyPassword(stored.PasswordHash, parsed.data.currentPassword))) {
    return { ok: false, error: t("settings.wrongPassword"), fieldErrors: { currentPassword: [t("settings.wrongPassword")] } };
  }
  await users.updatePasswordHash(user.id, await hashPassword(parsed.data.newPassword));
  resetTokens(key);
  return { ok: true, message: t("settings.passwordChanged") };
}
