import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { execute, queryOne, sql } from "../db";

export type TokenPurpose = "VerifyEmail" | "ResetPassword";

/** Lifetimes: verification links are valid for a day, reset links for 30 minutes. */
export const TOKEN_TTL_MINUTES: Record<TokenPurpose, number> = { VerifyEmail: 24 * 60, ResetPassword: 30 };

// 32 random bytes (256 bits) as base64url: 43 characters. Only the SHA-256 hash is stored, so a copy of
// the database does not contain usable links. A hash lookup needs no secret: guessing is infeasible.
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest();

/**
 * Issues a new single-use token and retires the user's earlier unused tokens of the same purpose
 * (only the newest link works). Returns the raw token, which is only ever put into the email.
 */
export async function issueToken(userId: number, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await execute(
    `UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME() WHERE UserID = @userId AND Purpose = @purpose AND UsedAt IS NULL;
     INSERT INTO dbo.Account_Tokens (UserID, Purpose, TokenHash, ExpiresAt)
     VALUES (@userId, @purpose, @hash, DATEADD(MINUTE, @ttl, SYSUTCDATETIME()));`,
    {
      userId: [sql.Int, userId],
      purpose: [sql.VarChar(20), purpose],
      hash: [sql.VarBinary(32), hashToken(token)],
      ttl: [sql.Int, TOKEN_TTL_MINUTES[purpose]],
    },
  );
  return token;
}

/**
 * Atomically marks a valid token as used and returns its user. A token that is malformed, unknown,
 * expired, already used or for another purpose returns undefined. Two concurrent attempts with the
 * same token: only one UPDATE can match the "UsedAt IS NULL" row.
 */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<number | undefined> {
  if (!TOKEN_FORMAT.test(token)) return undefined;
  const row = await queryOne<{ UserID: number }>(
    `UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME()
     OUTPUT inserted.UserID
      WHERE TokenHash = @hash AND Purpose = @purpose AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()`,
    { hash: [sql.VarBinary(32), hashToken(token)], purpose: [sql.VarChar(20), purpose] },
  );
  return row?.UserID;
}

/** Whether a token can still be used (for showing the right page state; does not consume it). */
export async function isTokenUsable(token: string, purpose: TokenPurpose): Promise<boolean> {
  if (!TOKEN_FORMAT.test(token)) return false;
  const row = await queryOne<{ Usable: number }>(
    `SELECT 1 AS Usable FROM dbo.Account_Tokens
      WHERE TokenHash = @hash AND Purpose = @purpose AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()`,
    { hash: [sql.VarBinary(32), hashToken(token)], purpose: [sql.VarChar(20), purpose] },
  );
  return row !== undefined;
}
