// Anonymises ONE student account on request (docs/privacy.md, "Deletion requests").
// Default is a dry run that changes nothing and prints what would happen.
//
//   node --env-file=.env.local scripts/privacy/anonymize-account.mjs --user 42                       # dry run
//   node --env-file=.env.local scripts/privacy/anonymize-account.mjs --user 42 --by 1 --apply --confirm 42
//
// Why anonymise instead of DELETE: journeys, tasks and help requests are linked by foreign keys without
// cascades, mentors' answers belong to the mentor's history, and counts in reports must stay correct.
// What changes, in ONE transaction:
//   Users          name -> "Deleted" "User", email -> deleted-<id>@anonymized.invalid, password hash ->
//                  an unusable marker (no sign-in possible), IsActive = 0, SessionVersion + 1 (ends every
//                  session), EmailVerifiedAt = NULL
//   Journeys       HomeCountryCode -> NULL (arrival date, programme and accommodation stay for statistics)
//   Help_Requests  subject, problem description and the answer text on the student's own requests ->
//                  "[removed]" (status, dates and mentor link stay)
//   Account_Tokens the user's one-time tokens are deleted (cascade target, holds only hashes)
//   Admin_Audit_Events one append-only event "user_anonymize" by the administrator given with --by
// Safeguards: students only (mentors and administrators are refused: their names appear in other
// people's history); --apply needs --confirm with the same id and an active administrator for --by;
// an already anonymised account is reported and left alone (idempotent); FirstSteps_Dev additionally
// needs ANONYMIZE_ALLOW_DEV=1. Not covered: database backups keep the old values until they expire
// (backup retention, docs/privacy.md), and application logs keep user ids (not names or emails).
import sql from "mssql";
import { loadDbConfig } from "../db/config.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const userId = Number(option("user"));
const apply = args.includes("--apply");
if (!Number.isInteger(userId) || userId <= 0) throw new Error("Usage: --user <id> [--by <adminId> --apply --confirm <id>]");
if (apply) {
  if (Number(option("confirm")) !== userId) throw new Error("--apply needs --confirm <the same user id>.");
  if (!Number.isInteger(Number(option("by")))) throw new Error("--apply needs --by <administrator user id>.");
}
const config = loadDbConfig();
if (apply && config.database === "FirstSteps_Dev" && process.env.ANONYMIZE_ALLOW_DEV !== "1") {
  throw new Error("Refusing to change FirstSteps_Dev without ANONYMIZE_ALLOW_DEV=1.");
}

const MARKER = "[removed]";
const pool = await sql.connect(config);
const tx = new sql.Transaction(pool);
await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
let committed = false;
try {
  const request = () => new sql.Request(tx).input("id", sql.Int, userId);
  const user = (await request().query("SELECT UserID, UserRole, Email, IsActive FROM dbo.Users WITH (UPDLOCK) WHERE UserID = @id")).recordset[0];
  if (!user) throw new Error(`User ${userId} not found.`);
  if (user.UserRole !== "Student") throw new Error(`User ${userId} is a ${user.UserRole}; only student accounts can be anonymised with this script.`);
  if (user.Email === `deleted-${userId}@anonymized.invalid`) {
    console.log(JSON.stringify({ event: "anonymize_skipped", userId, reason: "already anonymised" }));
  } else {
    const counts = (
      await request().query(`
        SELECT (SELECT COUNT(*) FROM dbo.Journeys WHERE UserID = @id) AS journeys,
               (SELECT COUNT(*) FROM dbo.Help_Requests h JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = h.JourneyTaskID
                  JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID WHERE j.UserID = @id) AS helpRequests,
               (SELECT COUNT(*) FROM dbo.Account_Tokens WHERE UserID = @id) AS tokens`)
    ).recordset[0];
    console.log(JSON.stringify({ event: apply ? "anonymize_apply" : "anonymize_dry_run", database: config.database, userId, ...counts }));
    if (apply) {
      const by = Number(option("by"));
      const admin = (await new sql.Request(tx).input("by", sql.Int, by).query("SELECT 1 AS ok FROM dbo.Users WHERE UserID = @by AND UserRole = N'Admin' AND IsActive = 1")).recordset[0];
      if (!admin) throw new Error(`--by ${by} is not an active administrator.`);
      await request()
        .input("marker", sql.NVarChar(20), MARKER)
        .input("email", sql.NVarChar(255), `deleted-${userId}@anonymized.invalid`)
        .query(`
          UPDATE dbo.Users SET FirstName = N'Deleted', LastName = N'User', Email = @email, PasswordHash = N'!anonymized',
                 IsActive = 0, SessionVersion = SessionVersion + 1, EmailVerifiedAt = NULL WHERE UserID = @id;
          UPDATE dbo.Journeys SET HomeCountryCode = NULL WHERE UserID = @id;
          UPDATE h SET Subject = @marker, ProblemDescription = @marker, ResolutionText = CASE WHEN h.ResolutionText IS NULL THEN NULL ELSE @marker END
            FROM dbo.Help_Requests h JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = h.JourneyTaskID JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
           WHERE j.UserID = @id;
          DELETE FROM dbo.Account_Tokens WHERE UserID = @id;`);
      await new sql.Request(tx)
        .input("by", sql.Int, by)
        .input("id", sql.Int, userId)
        .input("details", sql.NVarChar(sql.MAX), JSON.stringify({ journeys: counts.journeys, helpRequests: counts.helpRequests }))
        .query("INSERT INTO dbo.Admin_Audit_Events (AdminUserID, Action, EntityType, EntityID, Details) VALUES (@by, 'user_anonymize', 'User', @id, @details)");
      await tx.commit();
      committed = true;
      console.log(JSON.stringify({ event: "anonymize_done", userId }));
    }
  }
} finally {
  if (!committed) await tx.rollback();
  await pool.close();
}
