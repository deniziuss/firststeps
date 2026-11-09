import "server-only";
import { getPool } from "./db";
import { env } from "./env";
import { log } from "./log";

type Check = "config" | "database" | "schema";

export async function checkReadiness(): Promise<{ status: "ready" | "unavailable"; failed?: Check }> {
  const fail = (failed: Check, error?: unknown) => {
    void log("warn", "health", "not_ready", { failed, errorName: (error as Error | undefined)?.name });
    return { status: "unavailable" as const, failed };
  };
  try {
    env();
  } catch (error) {
    return fail("config", error);
  }
  try {
    const pool = await Promise.race([
      getPool(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    const request = pool.request();
    const result = await request.query<{ Ready: number }>(
      "SELECT CASE WHEN OBJECT_ID(N'dbo.Rate_Limit_Buckets', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.Admin_Audit_Events', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NOT NULL THEN 1 ELSE 0 END AS Ready",
    );
    if (result.recordset[0]?.Ready !== 1) return fail("schema");
  } catch (error) {
    return fail("database", error);
  }
  return { status: "ready" };
}
