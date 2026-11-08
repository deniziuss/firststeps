import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with the library defaults (OWASP-recommended range).
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed or legacy hash (e.g. synthetic course test rows): never a valid login.
    return false;
  }
}
