import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "fs_session";
// Absolute lifetime of a session; after a day the user signs in again.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Session token claims (HS256, verified on every request):
 * - userId: the account. Role and active state are always read from the database.
 * - sv: the account's SessionVersion when the token was issued (migration 0004). Sign-out, a password
 *   change, and an admin role or status change increment the version in the database, so every
 *   older token is rejected. This survives server restarts and is shared by all instances.
 * - pv: a keyed fingerprint of the stored password hash, as a second check for passwords changed
 *   outside the application (for example directly in SQL).
 * - jti: a random token id (unique tokens; useful in logs).
 */
export type SessionPayload = { userId: number; sv: number; pv: string; jti: string; exp: number };

function key() {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export function passwordFingerprint(passwordHash: string) {
  return createHmac("sha256", env().SESSION_SECRET).update(`pv:${passwordHash}`).digest("base64url").slice(0, 22);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], requiredClaims: ["exp", "iat", "jti"] });
    const { userId, sv, pv, jti, exp } = payload;
    if (typeof userId !== "number" || !Number.isInteger(sv) || typeof pv !== "string" || typeof jti !== "string" || typeof exp !== "number") return null;
    return { userId, sv: sv as number, pv, jti, exp };
  } catch {
    return null;
  }
}

export async function createSession(userId: number, passwordHash: string, sessionVersion: number) {
  const token = await new SignJWT({ userId, sv: sessionVersion, pv: passwordFingerprint(passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key());
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Removes the cookie from this browser. Server-side revocation is the version bump in signOut(). */
export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}
