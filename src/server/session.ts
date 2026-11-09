import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "fs_session";
// Absolute lifetime of a session. Shorter than before (7 days) to limit how long a copied
// cookie stays useful; a signed-in user simply signs in again after a day.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Session token claims:
 * - userId: the account. Role and active state are always read from the database.
 * - pv: a keyed fingerprint of the stored password hash. Changing the password changes the hash,
 *   so every older token stops matching (all other devices are signed out).
 * - jti: a random token id, used to revoke this token on sign-out.
 */
export type SessionPayload = { userId: number; pv: string; jti: string; exp: number };

function key() {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export function passwordFingerprint(passwordHash: string) {
  return createHmac("sha256", env().SESSION_SECRET).update(`pv:${passwordHash}`).digest("base64url").slice(0, 22);
}

// Tokens revoked by sign-out, kept until they would have expired anyway. This list lives in the
// server process: it is complete for the single-process local deployment, but it is lost on restart
// and not shared between instances. Proposal 0004 (database session version) removes that limit.
// Stored on globalThis so every server bundle in the process shares one list.
const store = globalThis as typeof globalThis & { __fsRevokedSessions?: Map<string, number> };
const revoked = (store.__fsRevokedSessions ??= new Map<string, number>());

function isRevoked(jti: string) {
  const now = Date.now() / 1000;
  for (const [id, exp] of revoked) if (exp <= now) revoked.delete(id);
  return revoked.has(jti);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], requiredClaims: ["exp", "iat", "jti"] });
    const { userId, pv, jti, exp } = payload;
    if (typeof userId !== "number" || typeof pv !== "string" || typeof jti !== "string" || typeof exp !== "number") return null;
    if (isRevoked(jti)) return null;
    return { userId, pv, jti, exp };
  } catch {
    return null;
  }
}

export async function createSession(userId: number, passwordHash: string) {
  const token = await new SignJWT({ userId, pv: passwordFingerprint(passwordHash) })
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

/** Signs out: the token is revoked on the server, not only removed from the browser. */
export async function deleteSession() {
  const session = await readSession();
  if (session) revoked.set(session.jti, session.exp);
  (await cookies()).delete(COOKIE_NAME);
}
