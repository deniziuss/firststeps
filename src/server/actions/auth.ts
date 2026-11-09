"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActionI18n } from "@/i18n/server";
import type { Translate } from "@/i18n/translator";
import { fieldErrors, passwordChangeSchema, passwordResetSchema, profileSchema, registerSchema, resetRequestSchema, signInSchema } from "@/lib/validation";
import { passwordChangeBucket, registerBuckets, resetRequestBuckets, resetSubmitBuckets, signInBuckets, verificationResendBucket } from "../authLimits";
import { clientAddress } from "../client-ip";
import { HOME_BY_ROLE, requireUser } from "../dal";
import { withTransaction } from "../db";
import { keptValues, isUniqueViolation, toAppError, type ActionResult } from "../errors";
import { log, logError } from "../log";
import { appLink, sendMail } from "../mail";
import { renderAccountEmail } from "../mail-templates";
import type { Locale } from "@/i18n/config";
import { hashPassword, verifyPassword } from "../password";
import { hit, isBlocked, reset } from "../rateLimit";
import * as tokens from "../repositories/tokens";
import * as users from "../repositories/users";
import { createSession, deleteSession, readSession } from "../session";

// The client address comes from the trusted proxy's entry in X-Forwarded-For (see client-ip.ts).
async function client() {
  return clientAddress((await headers()).get("x-forwarded-for"));
}

/** Counts one event in every bucket; false when any of them is over its limit. */
async function hitAll(buckets: Parameters<typeof hit>[0][]) {
  const results = await Promise.all(buckets.map((bucket) => hit(bucket)));
  return results.every(Boolean);
}

async function sendVerificationEmail(userId: number, t: Translate, locale: Locale, kind: "verify" | "verifyResend" = "verify") {
  const recipient = await users.findMailRecipient(userId);
  if (!recipient || recipient.EmailVerifiedAt) return;
  const token = await tokens.issueToken(userId, "VerifyEmail");
  const content = renderAccountEmail(kind, t, locale, { name: recipient.FirstName, link: appLink(`/verify-email/${token}`), hours: tokens.TOKEN_TTL_MINUTES.VerifyEmail / 60 });
  await sendMail({ to: recipient.Email, ...content }, kind === "verify" ? "verify_email" : "verify_email_resend");
}

export async function register(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const values = keptValues(formData, ["firstName", "lastName", "email"]);
  const { t, has, locale } = await getActionI18n();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, values, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };
  const { firstName, lastName, email, password } = parsed.data;

  let userId: number;
  const passwordHash = await hashPassword(password);
  try {
    if (!(await hitAll(registerBuckets(email, await client())))) return { ok: false, values, error: t("auth.tooManyAttempts") };
    userId = await users.createStudent({ firstName, lastName, email, passwordHash });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, values, error: t("auth.emailTaken"), fieldErrors: { email: [t("auth.emailTaken")] } };
    // Database unavailable or another unexpected failure: logged, and the form keeps its values.
    return { ok: false, values, error: t(toAppError(error).key) };
  }
  // The account works right away; the verification email can be resent from the dashboard if it fails.
  try {
    await sendVerificationEmail(userId, t, locale);
  } catch {
    // Already logged by sendMail.
  }
  // A new account starts at SessionVersion 0 (column default).
  await createSession(userId, passwordHash, 0);
  redirect("/onboarding");
}

export async function signIn(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const started = performance.now();
  const values = keptValues(formData, ["email"]);
  const { t, has } = await getActionI18n();
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, values, error: t("auth.enterCredentials"), fieldErrors: fieldErrors(parsed.error, t, has) };
  const { email, password } = parsed.data;
  const buckets = signInBuckets(email, await client());
  const all = [buckets.pair, buckets.account, ...(buckets.client ? [buckets.client] : [])];

  let account: Awaited<ReturnType<typeof users.findCredentialsByEmail>>;
  try {
    const blocked = await Promise.all(all.map((bucket) => isBlocked(bucket)));
    if (blocked.some(Boolean)) {
      void log("warn", "auth", "sign_in_rate_limited");
      return { ok: false, values, error: t("auth.tooManyAttempts") };
    }
    account = await users.findCredentialsByEmail(email);
  } catch (error) {
    return { ok: false, values, error: t(toAppError(error).key) };
  }
  // Same message and similar timing for unknown email, wrong password and inactive account.
  const valid = account ? await verifyPassword(account.PasswordHash, password) : (await hashPassword(password), false);
  if (!account || !valid || !account.IsActive) {
    await hitAll(all).catch(() => undefined);
    void log("info", "auth", "sign_in_failed", { reason: !account ? "unknown_account" : !valid ? "wrong_password" : "inactive", ms: Math.round(performance.now() - started) });
    return { ok: false, values, error: t("auth.wrongCredentials") };
  }

  await reset(buckets.pair).catch(() => undefined);
  await createSession(account.UserID, account.PasswordHash, account.SessionVersion);
  // ms = server time of the action (rate-limit checks, lookup, Argon2, session); compare with the
  // proxy's request time to separate server processing from network and client time.
  void log("info", "auth", "sign_in", { userId: account.UserID, ms: Math.round(performance.now() - started) });
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
      logError("sign_out_revocation_failed", error, { userId: session.userId }, "auth");
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
  if (!(await hit(passwordChangeBucket(user.id)))) return { ok: false, error: t("auth.tooManyAttempts") };

  const stored = await users.findPasswordHash(user.id);
  if (!stored || !(await verifyPassword(stored.PasswordHash, parsed.data.currentPassword))) {
    return { ok: false, error: t("settings.wrongPassword"), fieldErrors: { currentPassword: [t("settings.wrongPassword")] } };
  }
  const newHash = await hashPassword(parsed.data.newPassword);
  const version = await users.updatePasswordHash(user.id, newHash);
  await reset(passwordChangeBucket(user.id));
  // The version bump ends every other session of this account; this browser gets a fresh token.
  await createSession(user.id, newHash, version);
  void log("info", "auth", "password_changed", { userId: user.id });
  return { ok: true, message: t("settings.passwordChanged") };
}

/**
 * "Forgot password": always the same answer, whether or not the address has an account, is
 * rate-limited or the email could not be sent, so the form cannot be used to find accounts.
 */
export async function requestPasswordReset(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const values = keptValues(formData, ["email"]);
  const { t, has, locale } = await getActionI18n();
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, values, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };
  const generic: ActionResult = { ok: true, message: t("auth.resetRequested") };
  try {
    if (!(await hitAll(resetRequestBuckets(parsed.data.email, await client())))) return generic;
    const account = await users.findActiveUserIdByEmail(parsed.data.email);
    if (!account) {
      // Comparable work to the real path, to reduce the timing difference.
      await tokens.isTokenUsable("x".repeat(43), "ResetPassword");
      return generic;
    }
    const recipient = await users.findMailRecipient(account.UserID);
    const token = await tokens.issueToken(account.UserID, "ResetPassword");
    const content = renderAccountEmail("reset", t, locale, { name: recipient!.FirstName, link: appLink(`/reset-password/${token}`), minutes: tokens.TOKEN_TTL_MINUTES.ResetPassword });
    await sendMail({ to: recipient!.Email, ...content }, "reset_password");
    void log("info", "auth", "password_reset_requested", { userId: account.UserID });
  } catch (error) {
    logError("password_reset_request_failed", error, {}, "auth");
  }
  return generic;
}

/** Sets a new password from a reset link. The link is single-use and ends every session. */
export async function resetPassword(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { t, has } = await getActionI18n();
  const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };
  try {
    if (!(await hitAll(resetSubmitBuckets(await client())))) return { ok: false, error: t("auth.tooManyAttempts") };
    const newHash = await hashPassword(parsed.data.newPassword);
    // Token consumption and the password change commit together: a failure leaves the link usable.
    const userId = await withTransaction(async () => {
      const id = await tokens.consumeToken(parsed.data.token, "ResetPassword");
      if (id === undefined) return undefined;
      return (await users.resetPassword(id, newHash)) ? id : undefined;
    });
    if (userId === undefined) return { ok: false, error: t("auth.resetInvalid") };
    void log("info", "auth", "password_reset", { userId });
  } catch (error) {
    return { ok: false, error: t(toAppError(error).key) };
  }
  redirect("/sign-in?reset=1");
}

const tokenSchema = z.object({ token: z.string().max(100) });

/** Confirms an email address. A button press (POST), so link scanners cannot use up the token. */
export async function confirmEmail(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { t } = await getActionI18n();
  const parsed = tokenSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("verify.invalid") };
  try {
    const userId = await withTransaction(async () => {
      const id = await tokens.consumeToken(parsed.data.token, "VerifyEmail");
      if (id !== undefined) await users.markEmailVerified(id);
      return id;
    });
    if (userId === undefined) return { ok: false, error: t("verify.invalid") };
    void log("info", "auth", "email_verified", { userId });
    return { ok: true, message: t("verify.done") };
  } catch (error) {
    return { ok: false, error: t(toAppError(error).key) };
  }
}

export async function resendVerification(): Promise<ActionResult> {
  const user = await requireUser();
  const { t, locale } = await getActionI18n();
  if (user.emailVerified) return { ok: true, message: t("verify.alreadyVerified") };
  try {
    if (!(await hit(verificationResendBucket(user.id)))) return { ok: false, error: t("auth.tooManyAttempts") };
    await sendVerificationEmail(user.id, t, locale, "verifyResend");
    return { ok: true, message: t("verify.resent") };
  } catch (error) {
    logError("verification_resend_failed", error, { userId: user.id }, "auth");
    return { ok: false, error: t("verify.sendFailed") };
  }
}
