import "server-only";
import { type Params, query, queryOne, sql } from "../db";

/**
 * Personal data export for the signed-in account (docs/privacy.md). Everything is selected by the
 * caller's own UserID; nothing is taken from the request.
 *
 * Included: profile, account dates, journeys, journey tasks, the student's help requests (with the
 * mentor's answer, without the mentor's identity), answers a mentor wrote (without the student's
 * identity or question), and the number of admin audit events.
 * Never included: password hash, session version, token hashes, rate-limit keys, other people's data.
 */
export async function exportAccountData(userId: number) {
  const id: Params = { UserID: [sql.Int, userId] };
  const account = await queryOne<Record<string, unknown>>(
    `SELECT UserID AS userId, FirstName AS firstName, LastName AS lastName, Email AS email, UserRole AS role,
            IsActive AS active, CreatedAt AS createdAt, EmailVerifiedAt AS emailVerifiedAt
       FROM dbo.Users WHERE UserID = @UserID`,
    id,
  );
  if (!account) return undefined;
  const journeys = await query<Record<string, unknown>>(
    `SELECT j.JourneyID AS journeyId, u.UniversityName AS university, u.City AS city, j.ArrivalDate AS arrivalDate,
            j.ProgramType AS program, j.HomeCountryCode AS homeCountry, j.AccommodationStatus AS accommodation,
            j.JourneyStatus AS status, j.CreatedAt AS createdAt
       FROM dbo.Journeys j JOIN dbo.Universities u ON u.UniversityID = j.UniversityID
      WHERE j.UserID = @UserID ORDER BY j.JourneyID`,
    id,
  );
  const tasks = await query<Record<string, unknown>>(
    `SELECT jt.JourneyID AS journeyId, jt.JourneyTaskID AS journeyTaskId, t.TaskTitle AS task, jt.TaskStatus AS status,
            jt.DueDate AS dueDate, jt.CompletedAt AS completedAt, jt.CreatedAt AS createdAt
       FROM dbo.Journey_Tasks jt JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID JOIN dbo.Task_Templates t ON t.TaskID = jt.TaskID
      WHERE j.UserID = @UserID ORDER BY jt.JourneyID, jt.JourneyTaskID`,
    id,
  );
  const helpRequests = await query<Record<string, unknown>>(
    `SELECT h.RequestID AS requestId, h.JourneyTaskID AS journeyTaskId, h.Subject AS subject, h.ProblemDescription AS problem,
            h.RequestStatus AS status, h.ResolutionText AS answer, h.CreatedAt AS createdAt, h.ResolvedAt AS resolvedAt
       FROM dbo.Help_Requests h JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = h.JourneyTaskID JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
      WHERE j.UserID = @UserID ORDER BY h.RequestID`,
    id,
  );
  const answersWritten = await query<Record<string, unknown>>(
    `SELECT RequestID AS requestId, ResolutionText AS answer, ResolvedAt AS resolvedAt
       FROM dbo.Help_Requests WHERE MentorUserID = @UserID AND ResolutionText IS NOT NULL ORDER BY RequestID`,
    id,
  );
  const audit = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM dbo.Admin_Audit_Events WHERE AdminUserID = @UserID`,
    id,
  );
  return {
    format: "firststeps-account-export/1",
    exportedAt: new Date().toISOString(),
    account,
    journeys,
    tasks,
    helpRequests,
    answersWritten,
    adminAuditEvents: audit?.count ?? 0,
    notIncluded: ["password hash", "session data", "one-time token hashes", "rate-limit records", "data of other people"],
  };
}
