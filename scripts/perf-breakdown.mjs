// Splits sign-in / dashboard latency into its parts (local test database only):
//   A. Argon2id: hash and verify with the app's parameters, alone and 40 at the same time
//   B. SQL execution time on the server (sys.dm_exec_query_stats, read with Windows authentication)
//   C. Client-side time for the same query alone and in a burst of 40 through a 10-connection pool;
//      burst minus alone ~ waiting for a pooled connection (plus some server queueing)
// Usage: DB_NAME=FirstSteps_Test node --env-file=.env.local scripts/perf-breakdown.mjs
import { execFileSync } from "node:child_process";
import { hash, verify } from "@node-rs/argon2";
import sql from "mssql";
import { loadDbConfig } from "./db/config.mjs";

if (process.env.DB_NAME !== "FirstSteps_Test") throw new Error("Run against DB_NAME=FirstSteps_Test only.");
const OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const p95 = (v) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * 0.95))];
const fmt = (v) => `median ${median(v).toFixed(1)} ms, p95 ${p95(v).toFixed(1)} ms`;
const timed = async (fn) => {
  const s = performance.now();
  await fn();
  return performance.now() - s;
};

// A. Argon2id
const stored = await hash("Perf-breakdown-password-1", OPTIONS);
const hashOne = [];
const verifyOne = [];
for (let i = 0; i < 20; i++) {
  hashOne.push(await timed(() => hash(`Perf-${i}-password`, OPTIONS)));
  verifyOne.push(await timed(() => verify(stored, "Perf-breakdown-password-1")));
}
console.log(`A  argon2id hash, one at a time        ${fmt(hashOne)}`);
console.log(`A  argon2id verify, one at a time      ${fmt(verifyOne)}`);
const burstStart = performance.now();
const verifyBurst = await Promise.all(Array.from({ length: 40 }, () => timed(() => verify(stored, "Perf-breakdown-password-1"))));
console.log(`A  argon2id verify, 40 at once         ${fmt(verifyBurst)} (all done after ${(performance.now() - burstStart).toFixed(0)} ms; UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE ?? "4 (default)"})`);

// C. The dashboard's heaviest query (journeys with university), alone and in a burst
const pool = await sql.connect({ ...loadDbConfig(), pool: { max: 10 } });
const QUERY_TAG = "/* perf-breakdown */";
const userId = (await pool.request().query("SELECT TOP (1) UserID FROM dbo.Users ORDER BY UserID")).recordset[0].UserID;
const run = () =>
  pool.request().input("userId", sql.Int, userId).query(
    `${QUERY_TAG} SELECT j.JourneyID, j.UniversityID, u.UniversityName, u.City, u.Country, j.ArrivalDate, j.ProgramType, j.AccommodationStatus, j.JourneyStatus,
       (SELECT COUNT(*) FROM dbo.Journey_Tasks jt WHERE jt.JourneyID = j.JourneyID) AS TaskCount
     FROM dbo.Journeys j JOIN dbo.Universities u ON u.UniversityID = j.UniversityID WHERE j.UserID = @userId ORDER BY j.ArrivalDate DESC`,
  );
await run();
const alone = [];
for (let i = 0; i < 40; i++) alone.push(await timed(run));
const burst = await Promise.all(Array.from({ length: 40 }, () => timed(run)));
console.log(`C  query, client time, alone            ${fmt(alone)}`);
console.log(`C  query, client time, 40 at once       ${fmt(burst)}`);
console.log(`C  => estimated pool wait in the burst  median ${(median(burst) - median(alone)).toFixed(1)} ms, p95 ${(p95(burst) - median(alone)).toFixed(1)} ms`);
await pool.close();

// B. Server-side execution of the same statement (Windows authentication, read-only DMV)
const out = execFileSync("sqlcmd", ["-S", "tcp:127.0.0.1,1433", "-E", "-C", "-h", "-1", "-W", "-Q",
  `SET NOCOUNT ON; SELECT CONCAT(SUM(qs.execution_count), ' executions, server time per execution ', CAST(SUM(qs.total_elapsed_time) / 1000.0 / SUM(qs.execution_count) AS DECIMAL(10,3)), ' ms, max ', CAST(MAX(qs.max_elapsed_time) / 1000.0 AS DECIMAL(10,3)), ' ms') FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st WHERE st.text LIKE N'%perf-breakdown%' AND st.text NOT LIKE N'%dm_exec_query_stats%'`],
  { encoding: "utf8" }).trim();
console.log(`B  query, SQL Server execution          ${out}`);
