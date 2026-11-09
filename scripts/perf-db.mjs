// Latency and concurrency of the security procedures (local test database only, synthetic keys).
//   - median / p95 of usp_RateLimit_Hit and _Peek, one token issue + consume, and the per-request
//     session lookup, each over N sequential calls through the app login and connection pool
//   - correctness under concurrency: 100 parallel hits on ONE key must end at exactly 100
// All rows it creates are removed at the end (rate-limit keys "perf-…", one synthetic qa+ user).
// Usage: DB_NAME=FirstSteps_Test node --env-file=.env.local scripts/perf-db.mjs
import { createHash, randomBytes } from "node:crypto";
import sql from "mssql";
import { loadDbConfig } from "./db/config.mjs";

if (process.env.DB_NAME !== "FirstSteps_Test") throw new Error("Run against DB_NAME=FirstSteps_Test only.");
const pool = await sql.connect({ ...loadDbConfig(), pool: { max: 10 } });
const N = 200;
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return `median ${at(0.5).toFixed(2)} ms   p95 ${at(0.95).toFixed(2)} ms`;
};
async function time(label, run) {
  const samples = [];
  for (let i = 0; i < N; i++) {
    const started = performance.now();
    await run(i);
    samples.push(performance.now() - started);
  }
  console.log(`${label.padEnd(34)} ${stats(samples)}`);
}
const key = (text) => createHash("sha256").update(text).digest("hex");

const hit = (k) => pool.request().input("BucketKey", sql.Char(64), k).input("Scope", sql.VarChar(30), "perf").input("WindowSeconds", sql.Int, 300).output("Hits", sql.Int).execute("dbo.usp_RateLimit_Hit");
await time("rate limit hit (new key each time)", (i) => hit(key(`perf-new-${i}-${Date.now()}`)));
await time("rate limit hit (same key)", () => hit(key("perf-same")));
await time("rate limit peek", () => pool.request().input("BucketKey", sql.Char(64), key("perf-same")).output("Hits", sql.Int).execute("dbo.usp_RateLimit_Peek"));

const parallelKey = key(`perf-parallel-${Date.now()}`);
const started = performance.now();
await Promise.all(Array.from({ length: 100 }, () => hit(parallelKey)));
const { recordset } = await pool.request().input("k", sql.Char(64), parallelKey).query("SELECT Hits FROM dbo.Rate_Limit_Buckets WHERE BucketKey = @k");
console.log(`100 parallel hits on one key        final count ${recordset[0].Hits} (expected 100) in ${(performance.now() - started).toFixed(0)} ms ${recordset[0].Hits === 100 ? "PASS" : "FAIL"}`);
if (recordset[0].Hits !== 100) process.exitCode = 1;

const user = await pool
  .request()
  .input("email", sql.NVarChar(255), `qa+perf-db-${Date.now()}@example.invalid`)
  .query("INSERT INTO dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'Perf', N'Db', @email, N'x'); SELECT CONVERT(INT, SCOPE_IDENTITY()) AS UserID;");
const userId = user.recordset[0].UserID;
await time("token issue + consume", async () => {
  const hash = createHash("sha256").update(randomBytes(32)).digest();
  await pool.request().input("u", sql.Int, userId).input("h", sql.VarBinary(32), hash).query(
    "INSERT INTO dbo.Account_Tokens (UserID, Purpose, TokenHash, ExpiresAt) VALUES (@u, 'VerifyEmail', @h, DATEADD(MINUTE, 30, SYSUTCDATETIME()))",
  );
  await pool.request().input("h", sql.VarBinary(32), hash).query(
    "UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME() OUTPUT inserted.UserID WHERE TokenHash = @h AND Purpose = 'VerifyEmail' AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()",
  );
});
await time("session lookup (every request)", () =>
  pool.request().input("u", sql.Int, userId).query("SELECT UserID, FirstName, LastName, Email, UserRole, IsActive, CreatedAt, PasswordHash, SessionVersion, EmailVerifiedAt FROM dbo.Users WHERE UserID = @u"),
);

await pool.request().input("u", sql.Int, userId).query("DELETE FROM dbo.Users WHERE UserID = @u");
await pool.request().query("DELETE FROM dbo.Rate_Limit_Buckets WHERE Scope = 'perf'");
await pool.close();
