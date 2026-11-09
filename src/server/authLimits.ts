import type { Bucket } from "./rateLimit";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/**
 * Rate-limit policy for account operations. Only FAILED sign-ins count; a success clears the
 * client/account pair.
 *
 * Sign-in uses three buckets:
 * - pair (client + account), 5 failures / 15 min: stops guessing one password from one place.
 * - client, 30 failures / 15 min: stops password spraying (many accounts from one place).
 * - account, 50 failures / hour: stops distributed guessing against one account.
 *
 * Why lock-out is hard: one client can only lock its own pair. Locking an account for everyone takes
 * 50 failures from at least 10 different addresses within an hour. The client address is known
 * only behind a trusted proxy (TRUST_PROXY=true, required for public deployments). Without one
 * (local use), every request shares the "direct" client, so the pair limit acts per account.
 */
export function signInBuckets(email: string, client: string | undefined) {
  const where = client ?? "direct";
  return {
    pair: { scope: "signin_pair", subject: `${where}|${email}`, limit: 5, windowSeconds: 15 * MINUTE },
    account: { scope: "signin_account", subject: email, limit: 50, windowSeconds: HOUR },
    client: client ? { scope: "signin_client", subject: client, limit: 30, windowSeconds: 15 * MINUTE } : undefined,
  } satisfies Record<string, Bucket | undefined>;
}

export function registerBuckets(email: string, client: string | undefined): Bucket[] {
  return [
    { scope: "register_email", subject: email, limit: 3, windowSeconds: HOUR },
    ...(client ? [{ scope: "register_client", subject: client, limit: 10, windowSeconds: HOUR }] : []),
  ];
}

export function resetRequestBuckets(email: string, client: string | undefined): Bucket[] {
  return [
    { scope: "reset_email", subject: email, limit: 3, windowSeconds: HOUR },
    ...(client ? [{ scope: "reset_client", subject: client, limit: 10, windowSeconds: HOUR }] : []),
  ];
}

export function resetSubmitBuckets(client: string | undefined): Bucket[] {
  return [{ scope: "reset_submit", subject: client ?? "direct", limit: 20, windowSeconds: 15 * MINUTE }];
}

export function verificationResendBucket(userId: number): Bucket {
  return { scope: "verify_resend", subject: String(userId), limit: 3, windowSeconds: HOUR };
}

export function passwordChangeBucket(userId: number): Bucket {
  return { scope: "password_change", subject: String(userId), limit: 5, windowSeconds: 15 * MINUTE };
}

/** Data export: 10 downloads per hour per account. */
export function authLimitsExport(userId: number): Bucket {
  return { scope: "data_export", subject: String(userId), limit: 10, windowSeconds: HOUR };
}
