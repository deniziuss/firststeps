import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "fs_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = { userId: number };

function key() {
  return new TextEncoder().encode(env().SESSION_SECRET);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.userId === "number" ? { userId: payload.userId } : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}
