// Removes synthetic records created by automated tests from the LOCAL FirstSteps_Dev database.
//
// Safety rules (all enforced in this file):
// - Local server and FirstSteps_Dev only (config.mjs refuses anything else, and the connected database is re-checked).
// - Dry run by default: everything runs in a transaction that is rolled back and only counts are printed.
//   `--apply` commits.
// - A user is a test user only when ALL of these hold:
//     * the email starts with a test prefix (e2e+, sweep+, qa+, title+) and ends with @example.invalid
//       (.invalid is reserved by RFC 2606, so it can never be a real person's address),
//     * the role is Student (Admin and Mentor accounts are never touched),
//     * with --since, the account was created at or after that time.
//   Seeded accounts (admin@, mentor@, ada.student@example.invalid) never match the prefixes.
// - A task template is a test template only when its English title starts with "E2E ", ends with the
//   13-digit timestamp the tests append, it is inactive, and no remaining journey uses it.
// - No TRUNCATE, no DDL, no schema change. Deletes run in dependency order inside one transaction.
//
// Usage:
//   npm run db:cleanup-test-data                       dry run, all test records
//   npm run db:cleanup-test-data -- --apply            delete all test records
//   npm run db:cleanup-test-data -- --since=<ISO date> limit to records created since then
//   npm run db:cleanup-test-data -- --self-test        check the selection rules on decoys (rolled back)
import sql from "mssql";
import { pathToFileURL } from "node:url";
import { loadDbConfig, LOCAL_DB_NAME } from "./config.mjs";

export const TEST_EMAIL_PREFIXES = ["e2e+", "sweep+", "qa+", "title+"];
const TEST_EMAIL_DOMAIN = "@example.invalid";

const TARGETS = `
  INSERT INTO #TestUsers (UserID)
  SELECT u.UserID
    FROM dbo.Users u
   WHERE u.UserRole = N'Student'
     AND RIGHT(u.Email, ${TEST_EMAIL_DOMAIN.length}) = @domain
     AND (${TEST_EMAIL_PREFIXES.map((_, i) => `LEFT(u.Email, LEN(@prefix${i})) = @prefix${i}`).join(" OR ")})
     AND (@since IS NULL OR u.CreatedAt >= @since);

  INSERT INTO #TestJourneys (JourneyID)
  SELECT j.JourneyID FROM dbo.Journeys j JOIN #TestUsers t ON t.UserID = j.UserID;`;

const DELETE_USERS = `
  DELETE h FROM dbo.Help_Requests h
    JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = h.JourneyTaskID
    JOIN #TestJourneys tj ON tj.JourneyID = jt.JourneyID;
  SET @helpRequests = @@ROWCOUNT;
  DELETE jt FROM dbo.Journey_Tasks jt JOIN #TestJourneys tj ON tj.JourneyID = jt.JourneyID;
  SET @journeyTasks = @@ROWCOUNT;
  DELETE j FROM dbo.Journeys j JOIN #TestJourneys tj ON tj.JourneyID = j.JourneyID;
  SET @journeys = @@ROWCOUNT;
  DELETE u FROM dbo.Users u JOIN #TestUsers t ON t.UserID = u.UserID;
  SET @users = @@ROWCOUNT;`;

// Runs after the test journeys are gone, so "no remaining journey uses it" covers real journeys only.
const DELETE_TEMPLATES = `
  INSERT INTO #TestTemplates (TaskID)
  SELECT t.TaskID
    FROM dbo.Task_Templates t
   WHERE t.TaskTitle LIKE N'E2E %'
     AND t.IsActive = 0
     AND TRY_CAST(RIGHT(t.TaskTitle, 13) AS BIGINT) IS NOT NULL
     AND (@sinceMs IS NULL OR TRY_CAST(RIGHT(t.TaskTitle, 13) AS BIGINT) >= @sinceMs)
     AND NOT EXISTS (SELECT 1 FROM dbo.Journey_Tasks jt WHERE jt.TaskID = t.TaskID);

  DELETE d FROM dbo.Task_Dependencies d
   WHERE d.TaskID IN (SELECT TaskID FROM #TestTemplates) OR d.RequiredTaskID IN (SELECT TaskID FROM #TestTemplates);
  SET @dependencies = @@ROWCOUNT;
  DELETE FROM dbo.Information_Sources WHERE TaskID IN (SELECT TaskID FROM #TestTemplates); -- translations cascade
  SET @sources = @@ROWCOUNT;
  DELETE FROM dbo.Task_Template_Translations WHERE TaskID IN (SELECT TaskID FROM #TestTemplates);
  DELETE FROM dbo.Task_Templates WHERE TaskID IN (SELECT TaskID FROM #TestTemplates);
  SET @templates = @@ROWCOUNT;`;

// Runs the cleanup inside an open transaction and returns the deleted row counts.
async function runCleanup(tx, since) {
  const request = new sql.Request(tx)
    .input("domain", sql.NVarChar(255), TEST_EMAIL_DOMAIN)
    .input("since", sql.DateTime2(0), since)
    .input("sinceMs", sql.BigInt, since ? since.getTime() : null);
  TEST_EMAIL_PREFIXES.forEach((prefix, i) => request.input(`prefix${i}`, sql.NVarChar(20), prefix));
  for (const name of ["helpRequests", "journeyTasks", "journeys", "users", "dependencies", "sources", "templates"]) request.output(name, sql.Int);
  const result = await request.query(`
    SET NOCOUNT ON;
    CREATE TABLE #TestUsers (UserID INT PRIMARY KEY);
    CREATE TABLE #TestJourneys (JourneyID INT PRIMARY KEY);
    CREATE TABLE #TestTemplates (TaskID INT PRIMARY KEY);
    ${TARGETS}
    ${DELETE_USERS}
    ${DELETE_TEMPLATES}
    DROP TABLE #TestUsers; DROP TABLE #TestJourneys; DROP TABLE #TestTemplates;`);
  return result.output;
}

async function inLocalTransaction(work) {
  const pool = await sql.connect(loadDbConfig());
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const state = { commit: false };
  try {
    const { recordset } = await new sql.Request(tx).query("SELECT DB_NAME() AS CurrentDatabase");
    if (recordset[0].CurrentDatabase !== LOCAL_DB_NAME) throw new Error(`Connected to [${recordset[0].CurrentDatabase}], expected [${LOCAL_DB_NAME}].`);
    const value = await work(tx, state);
    if (state.commit) await tx.commit();
    return value;
  } finally {
    if (!state.commit) await tx.rollback();
    await pool.close();
  }
}

/** @param {{ apply?: boolean; since?: Date | null; log?: (line: string) => void }} [options] */
export async function cleanupTestData({ apply = false, since = null, log = console.log } = {}) {
  return inLocalTransaction(async (tx, state) => {
    const counts = await runCleanup(tx, since);
    state.commit = apply;
    log(`${apply ? "Deleted" : "Dry run, would delete"}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}${since ? ` (since ${since.toISOString()})` : ""}`);
    return counts;
  });
}

// Proves the selection rules on decoys inside a transaction that is always rolled back:
// only the account that matches every rule is removed.
export async function selfTest() {
  return inLocalTransaction(async (tx) => {
    const stamp = Date.now();
    const accounts = [
      { email: `e2e+selftest-${stamp}@example.invalid`, role: "Student", expectDeleted: true },
      { email: `e2e+selftest-${stamp}@example.com`, role: "Student", expectDeleted: false }, // other domain
      { email: `selftest-${stamp}@example.invalid`, role: "Student", expectDeleted: false }, // no test prefix
      { email: `xe2e+selftest-${stamp}@example.invalid`, role: "Student", expectDeleted: false }, // prefix not at the start
      { email: `e2e+selftest-mentor-${stamp}@example.invalid`, role: "Mentor", expectDeleted: false }, // not a student
    ];
    for (const a of accounts) {
      await new sql.Request(tx).input("email", sql.NVarChar(255), a.email).input("role", sql.NVarChar(20), a.role)
        .query("INSERT INTO dbo.Users (FirstName, LastName, Email, PasswordHash, UserRole) VALUES (N'Self', N'Test', @email, N'not-a-hash', @role)");
    }
    const since = new Date(Date.now() - 60_000);
    const before = await new sql.Request(tx).input("since", sql.DateTime2(0), new Date(since.getTime() - 1)).query("SELECT COUNT(*) AS N FROM dbo.Users WHERE CreatedAt < @since");
    await runCleanup(tx, since);
    const failures = [];
    for (const a of accounts) {
      const { recordset } = await new sql.Request(tx).input("email", sql.NVarChar(255), a.email).query("SELECT COUNT(*) AS N FROM dbo.Users WHERE Email = @email");
      if ((recordset[0].N === 0) !== a.expectDeleted) failures.push(`${a.email}: expected ${a.expectDeleted ? "deleted" : "kept"}`);
    }
    const after = await new sql.Request(tx).input("since", sql.DateTime2(0), new Date(since.getTime() - 1)).query("SELECT COUNT(*) AS N FROM dbo.Users WHERE CreatedAt < @since");
    if (after.recordset[0].N !== before.recordset[0].N) failures.push("accounts created before --since were deleted");
    console.log(failures.length ? `Self-test FAILED:\n${failures.join("\n")}` : `Self-test passed: 1 matching account removed, ${accounts.length - 1} decoys and all older accounts kept (rolled back).`);
    if (failures.length) process.exitCode = 1;
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) {
    await selfTest();
    process.exit();
  }
  const apply = process.argv.includes("--apply");
  const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.slice("--since=".length);
  const since = sinceArg ? new Date(sinceArg) : null;
  if (since && Number.isNaN(since.getTime())) throw new Error("--since must be a date, for example 2026-11-08T12:00:00Z");
  await cleanupTestData({ apply, since });
}
