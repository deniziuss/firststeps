"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActionI18n } from "@/i18n/server";
import { fieldErrors, passwordChangeSchema, profileSchema, registerSchema, signInSchema } from "@/lib/validation";
import { HOME_BY_ROLE, requireUser } from "../dal";
import { isUniqueViolation, toAppError, type ActionResult } from "../errors";
import { clientAddress } from "../client-ip";
import { hashPassword, verifyPassword } from "../password";
import { resetTokens, takeToken } from "../rateLimit";
import * as users from "../repositories/users";
import { logError } from "../log";
import { createSession, deleteSession, readSession } from "../session";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// The client address comes from the trusted proxy's entry in X-Forwarded-For (see client-ip.ts).
async function clientKey(scope: string, email: string) {
  const address = clientAddress((await headers()).get("x-forwarded-for"));
  return `${scope}:${address ?? "direct"}:${email}`;
}

export async function register(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { t, has } = await getActionI18n();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };

  const { firstName, lastName, email, password } = parsed.data;
  const allowed = takeToken(await clientKey("register", email), 5, FIFTEEN_MINUTES) && takeToken(await clientKey("register", "*"), 30, FIFTEEN_MINUTES);
  if (!allowed) return { ok: false, error: t("auth.tooManyAttempts") };

  let userId: number;
  const passwordHash = await hashPassword(password);
  try {
    userId = await users.createStudent({ firstName, lastName, email, passwordHash });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: t("auth.emailTaken"), fieldErrors: { email: [t("auth.emailTaken")] } };
    // Database unavailable or another unexpected failure: logged, and the form keeps its values.
    return { ok: false, error: t(toAppError(error).key) };
  }
  // A new account starts at SessionVersion 0 (column default).
  await createSession(userId, passwordHash, 0);
  redirect("/onboarding");
}

export async function signIn(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { t, has } = await getActionI18n();
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("auth.enterCredentials"), fieldErrors: fieldErrors(parsed.error, t, has) };

  const { email, password } = parsed.data;
  const key = await clientKey("sign-in", email);
  if (!takeToken(key, 5, FIFTEEN_MINUTES)) return { ok: false, error: t("auth.tooManyAttempts") };

  let account: Awaited<ReturnType<typeof users.findCredentialsByEmail>>;
  try {
    account = await users.findCredentialsByEmail(email);
  } catch (error) {
    return { ok: false, error: t(toAppError(error).key) };
  }
  // Same message and similar timing for unknown email, wrong password and inactive account.
  const valid = account ? await verifyPassword(account.PasswordHash, password) : (await hashPassword(password), false);
  if (!account || !valid || !account.IsActive) return { ok: false, error: t("auth.wrongCredentials") };

  resetTokens(key);
  await createSession(account.UserID, account.PasswordHash, account.SessionVersion);
  redirect(HOME_BY_ROLE[account.UserRole]);
}

// Signs the account out on every device: the version bump invalidates all of its tokens, also
// after a server restart. The cookie is removed even if the database cannot be reached.
export async function signOut() {
  const session = await readSession();
  if (session) {
    try {
      await users.bumpSessionVersion(session.userId);
    } catch (error) {
      logError("sign_out_revocation_failed", error, { userId: session.userId });
    }
  }
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
  const newHash = await hashPassword(parsed.data.newPassword);
  const version = await users.updatePasswordHash(user.id, newHash);
  resetTokens(key);
  // The version bump ends every other session of this account; this browser gets a fresh token.
  await createSession(user.id, newHash, version);
  return { ok: true, message: t("settings.passwordChanged") };
}
