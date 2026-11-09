// Security checks for proposal 0006, run WITH THE APPLICATION'S OWN LOGIN (firststeps_app: db_datareader,
// db_datawriter, EXECUTE) against the disposable test database. Everything it creates is removed.
//   1. Reset-token race: 20 parallel consume attempts of one token -> exactly one succeeds.
//   2. Rate-limit race: 100 parallel hits on one key -> count is exactly 100.
//   3. Registration race: 10 parallel inserts of the same email -> exactly one account.
//   4. Audit immutability under the app login: UPDATE, DELETE, TRUNCATE, DISABLE TRIGGER, DROP and
//      purge below 365 days are all refused.
//   5. Verification backfill: existing verified accounts stay verified; re-running the migration does
//      not mark new, unverified accounts as verified.
// Usage: DB_NAME=FirstSteps_Test node --env-file=.env.local scripts/verify-0006-security.mjs
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import sql from "mssql";
import { loadDbConfig } from "./db/config.mjs";

if (process.env.DB_NAME !== "FirstSteps_Test") throw new Error("Run against DB_NAME=FirstSteps_Test only.");
const config = loadDbConfig();
const pool = await sql.connect({ ...config, pool: { max: 20 } });
let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};
const stamp = Date.now();
// Owner-level steps (re-running the migration, removing this script's own audit rows) use sqlcmd:
// Windows authentication locally, or SQLCMD_USER with the password in SQLCMDPASSWORD (CI), so the
// password never appears on a command line.
const sqlcmdLogin = process.env.SQLCMD_USER ? ["-U", process.env.SQLCMD_USER] : ["-E"];
const ownerSqlcmd = (args) => execFileSync("sqlcmd", ["-S", "tcp:127.0.0.1,1433", ...sqlcmdLogin, "-C", "-b", "-d", "FirstSteps_Test", ...args], { stdio: "ignore" });
const login = (await pool.request().query("SELECT SUSER_SNAME() AS LoginName, DB_NAME() AS Db")).recordset[0];
console.log(`connected as ${login.LoginName} to ${login.Db}`);
check("tests run with the application login, not an administrator", login.LoginName === "firststeps_app", login.LoginName);

const newUser = async (suffix) =>
  (
    await pool
      .request()
      .input("email", sql.NVarChar(255), `qa+sec0006-${suffix}-${stamp}@example.invalid`)
      .query("INSERT INTO dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'Sec', N'Check', @email, N'x'); SELECT CONVERT(INT, SCOPE_IDENTITY()) AS UserID;")
  ).recordset[0].UserID;

// 1. Reset-token race
const userId = await newUser("token");
const hash = createHash("sha256").update(randomBytes(32)).digest();
await pool.request().input("u", sql.Int, userId).input("h", sql.VarBinary(32), hash).query(
  "INSERT INTO dbo.Account_Tokens (UserID, Purpose, TokenHash, ExpiresAt) VALUES (@u, 'ResetPassword', @h, DATEADD(MINUTE, 30, SYSUTCDATETIME()))",
);
const attempts = await Promise.all(
  Array.from({ length: 20 }, () =>
    pool.request().input("h", sql.VarBinary(32), hash).query(
      "UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME() OUTPUT inserted.UserID WHERE TokenHash = @h AND Purpose = 'ResetPassword' AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()",
    ),
  ),
);
const winners = attempts.filter((r) => r.recordset.length === 1).length;
check("reset token: 20 parallel uses, exactly one succeeds", winners === 1, `${winners} succeeded`);
const expired = createHash("sha256").update(randomBytes(32)).digest();
await pool.request().input("u", sql.Int, userId).input("h", sql.VarBinary(32), expired).query(
  "INSERT INTO dbo.Account_Tokens (UserID, Purpose, TokenHash, CreatedAt, ExpiresAt) VALUES (@u, 'ResetPassword', @h, DATEADD(HOUR, -2, SYSUTCDATETIME()), DATEADD(HOUR, -1, SYSUTCDATETIME()))",
);
const late = await pool.request().input("h", sql.VarBinary(32), expired).query(
  "UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME() OUTPUT inserted.UserID WHERE TokenHash = @h AND Purpose = 'ResetPassword' AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()",
);
check("reset token: an expired token cannot be used", late.recordset.length === 0);

// 2. Rate-limit race
const bucket = createHash("sha256").update(`sec0006-${stamp}`).digest("hex");
await Promise.all(
  Array.from({ length: 100 }, () =>
    pool.request().input("BucketKey", sql.Char(64), bucket).input("Scope", sql.VarChar(30), "sec0006").input("WindowSeconds", sql.Int, 300).output("Hits", sql.Int).execute("dbo.usp_RateLimit_Hit"),
  ),
);
const hits = (await pool.request().input("k", sql.Char(64), bucket).query("SELECT Hits FROM dbo.Rate_Limit_Buckets WHERE BucketKey = @k")).recordset[0]?.Hits;
check("rate limit: 100 parallel hits on one key count exactly 100", hits === 100, `count ${hits}`);

// 3. Registration race (the course procedure and UNIQUE(Email) decide)
const email = `qa+sec0006-race-${stamp}@example.invalid`;
const results = await Promise.allSettled(
  Array.from({ length: 10 }, () =>
    pool
      .request()
      .input("FirstName", sql.NVarChar(100), "Race")
      .input("LastName", sql.NVarChar(100), "Test")
      .input("Email", sql.NVarChar(255), email)
      .input("PasswordHash", sql.NVarChar(255), "x")
      .output("NewUserID", sql.Int)
      .execute("dbo.usp_User_Insert"),
  ),
);
const accounts = (await pool.request().input("e", sql.NVarChar(255), email).query("SELECT COUNT(*) AS N FROM dbo.Users WHERE Email = @e")).recordset[0].N;
const duplicates = results.filter((r) => r.status === "rejected" && [2627, 2601].includes(r.reason?.number ?? r.reason?.originalError?.info?.number)).length;
check("registration: 10 parallel sign-ups with one email create one account", accounts === 1, `${accounts} account(s), ${duplicates} unique-key rejections`);

// 4. Audit immutability with the application login
const admin = (await pool.request().query("SELECT TOP (1) UserID FROM dbo.Users WHERE UserRole = N'Admin' ORDER BY UserID")).recordset[0].UserID;
const event = (
  await pool.request().input("a", sql.Int, admin).query(
    "INSERT INTO dbo.Admin_Audit_Events (AdminUserID, Action, EntityType, EntityID, Details) OUTPUT inserted.EventID VALUES (@a, 'verify_0006', 'Test', 1, N'{}')",
  )
).recordset[0].EventID;
const refused = async (label, statement, expected) => {
  try {
    await pool.request().input("id", sql.BigInt, event).query(statement);
    check(label, false, "statement was accepted");
  } catch (error) {
    const number = error.number ?? error.originalError?.info?.number;
    check(label, expected.includes(number), `error ${number}`);
  }
};
await refused("audit: UPDATE is refused", "UPDATE dbo.Admin_Audit_Events SET Details = N'changed' WHERE EventID = @id", [51020]);
await refused("audit: DELETE is refused", "DELETE FROM dbo.Admin_Audit_Events WHERE EventID = @id", [51021]);
await refused("audit: TRUNCATE is refused (no ALTER permission)", "TRUNCATE TABLE dbo.Admin_Audit_Events", [1088, 3701, 4701]);
await refused("audit: DISABLE TRIGGER is refused", "DISABLE TRIGGER dbo.trg_AdminAuditEvents_AppendOnly ON dbo.Admin_Audit_Events", [1088, 3701, 4920]);
await refused("audit: DROP TABLE is refused", "DROP TABLE dbo.Admin_Audit_Events", [3701]);
await refused("audit: purge younger than 365 days is refused", "EXEC dbo.usp_AdminAudit_Purge @KeepDays = 30", [51023]);
const still = (await pool.request().input("id", sql.BigInt, event).query("SELECT Details FROM dbo.Admin_Audit_Events WHERE EventID = @id")).recordset[0];
check("audit: the event is unchanged afterwards", still?.Details === "{}");

// 5. Verification backfill
const before = (await pool.request().query("SELECT COUNT(*) AS N FROM dbo.Users WHERE EmailVerifiedAt IS NULL")).recordset[0].N;
ownerSqlcmd(["-i", "database/proposals/0006_security_infrastructure.sql"]);
const after = (await pool.request().query("SELECT COUNT(*) AS N FROM dbo.Users WHERE EmailVerifiedAt IS NULL")).recordset[0].N;
check("migration re-run does not verify unverified accounts", after === before, `${before} unverified before, ${after} after`);
// The seeded admin and mentor existed before 0006 and were backfilled as verified.
const seededEmails = [process.env.DEV_ADMIN_EMAIL, process.env.DEV_MENTOR_EMAIL].filter(Boolean);
const seeded = (await pool.request().input("a", sql.NVarChar(255), seededEmails[0] ?? "").input("m", sql.NVarChar(255), seededEmails[1] ?? "").query("SELECT COUNT(*) AS N FROM dbo.Users WHERE Email IN (@a, @m) AND EmailVerifiedAt IS NOT NULL")).recordset[0].N;
check("existing admin and mentor accounts stay verified", seededEmails.length === 2 && seeded === 2, `${seeded} of ${seededEmails.length}`);
const fresh = (await pool.request().input("u", sql.Int, userId).query("SELECT EmailVerifiedAt FROM dbo.Users WHERE UserID = @u")).recordset[0].EmailVerifiedAt;
check("a new account starts unverified", fresh === null);

// Cleanup (the audit event is test data in a disposable database; it is removed by an administrator
// connection because the application login cannot delete audit events, by design).
await pool.request().input("p", sql.NVarChar(255), `qa+sec0006-%-${stamp}@example.invalid`).query("DELETE FROM dbo.Users WHERE Email LIKE @p");
await pool.request().query("DELETE FROM dbo.Rate_Limit_Buckets WHERE Scope = 'sec0006'");
await pool.close();
ownerSqlcmd(["-Q",
  "ALTER TABLE dbo.Admin_Audit_Events DISABLE TRIGGER trg_AdminAuditEvents_AppendOnly; DELETE FROM dbo.Admin_Audit_Events WHERE Action = 'verify_0006'; ALTER TABLE dbo.Admin_Audit_Events ENABLE TRIGGER trg_AdminAuditEvents_AppendOnly;"]);
console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
