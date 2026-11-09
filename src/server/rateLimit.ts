import "server-only";
import { createHmac } from "node:crypto";
import { procedure, sql } from "./db";
import { env } from "./env";
import { log } from "./log";

/**
 * Persistent fixed-window rate limits in SQL Server (migration 0006, dbo.Rate_Limit_Buckets).
 *
 * - Survive restarts and are shared by every app instance (one database).
 * - Atomic: dbo.usp_RateLimit_Hit locks the key (UPDLOCK, HOLDLOCK), so concurrent requests cannot
 *   lose counts or race on the first insert.
 * - Private: a bucket key is an HMAC of "scope|subject" with the server secret, so the table holds no
 *   email address or IP and cannot be reversed with a dictionary.
 * - Bounded: expired windows are purged in small batches (about every 50th write, and by the backup job).
 *
 * Why SQL Server and not Redis: the application already depends on one SQL Server; at pilot scale a
 * keyed row update costs a few milliseconds (docs/performance.md), and a second stateful service would
 * add operations work without a security benefit.
 */
export type Bucket = { scope: string; subject: string; limit: number; windowSeconds: number };

function bucketKey(scope: string, subject: string) {
  return createHmac("sha256", env().SESSION_SECRET).update(`rl:${scope}|${subject.toLowerCase()}`).digest("hex");
}

/** Counts one event; returns true while the bucket is still within its limit. */
export async function hit(bucket: Bucket): Promise<boolean> {
  const { output } = await procedure(
    "dbo.usp_RateLimit_Hit",
    {
      BucketKey: [sql.Char(64), bucketKey(bucket.scope, bucket.subject)],
      Scope: [sql.VarChar(30), bucket.scope],
      WindowSeconds: [sql.Int, bucket.windowSeconds],
    },
    { Hits: sql.Int },
  );
  if (Math.random() < 0.02) void purgeExpired();
  const allowed = (output.Hits as number) <= bucket.limit;
  if (!allowed) void log("warn", "rate_limit", "rate_limited", { scope: bucket.scope, hits: output.Hits as number });
  return allowed;
}

/** True when the bucket has already reached its limit (does not count). */
export async function isBlocked(bucket: Bucket): Promise<boolean> {
  const { output } = await procedure("dbo.usp_RateLimit_Peek", { BucketKey: [sql.Char(64), bucketKey(bucket.scope, bucket.subject)] }, { Hits: sql.Int });
  return (output.Hits as number) >= bucket.limit;
}

export async function reset(bucket: Pick<Bucket, "scope" | "subject">) {
  await procedure("dbo.usp_RateLimit_Reset", { BucketKey: [sql.Char(64), bucketKey(bucket.scope, bucket.subject)] });
}

export async function purgeExpired() {
  try {
    await procedure("dbo.usp_RateLimit_Purge", { MaxRows: [sql.Int, 500] });
  } catch {
    // Best effort; the next purge retries.
  }
}
