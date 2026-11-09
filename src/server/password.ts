import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with the OWASP Password Storage Cheat Sheet minimum (m=19 MiB, t=2, p=1). The values
// are stated explicitly so a library update cannot silently weaken them; they match every stored
// hash ($argon2id$v=19$m=19456,t=2,p=1$…). verify() reads the parameters from each stored hash.
// algorithm 2 = Argon2id (the package exports it as a const enum, unusable with isolatedModules).
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed or legacy hash (e.g. synthetic course test rows): never a valid login.
    return false;
  }
}
