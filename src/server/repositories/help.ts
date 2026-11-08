import "server-only";
import type { RequestStatus } from "@/domain/statuses";
import type { Locale } from "@/i18n/config";
import { execute, procedure, query, queryOne, sql } from "../db";
import { AppError } from "../errors";
import { localizedTitle } from "./localized";

export type HelpRequestRow = {
  RequestID: number;
  JourneyTaskID: number;
  Subject: string;
  ProblemDescription: string;
  ResolutionText: string | null;
  RequestStatus: RequestStatus;
  CreatedAt: Date;
  ResolvedAt: Date | null;
  TaskTitle: string;
  MentorFirstName: string | null;
};

// Mentors see the student's first name and the task context only, no contact data.
export type MentorRequestRow = HelpRequestRow & { StudentFirstName: string; UniversityName: string; ArrivalDate: Date; ProgramType: string };

const REQUEST_SELECT = `
  SELECT hr.RequestID, hr.JourneyTaskID, hr.Subject, hr.ProblemDescription, hr.ResolutionText, hr.RequestStatus,
         hr.CreatedAt, hr.ResolvedAt, ${localizedTitle("t", "tt")} AS TaskTitle, m.FirstName AS MentorFirstName,
         s.FirstName AS StudentFirstName, u.UniversityName, j.ArrivalDate, j.ProgramType
    FROM dbo.Help_Requests hr
    JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = hr.JourneyTaskID
    JOIN dbo.Task_Templates t ON t.TaskID = jt.TaskID
    LEFT JOIN dbo.Task_Template_Translations tt ON tt.TaskID = t.TaskID AND tt.LanguageCode = @lang
    JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
    JOIN dbo.Users s ON s.UserID = j.UserID
    JOIN dbo.Universities u ON u.UniversityID = j.UniversityID
    LEFT JOIN dbo.Users m ON m.UserID = hr.MentorUserID`;

const STATUS_ORDER = "CASE hr.RequestStatus WHEN N'Open' THEN 1 WHEN N'Assigned' THEN 2 WHEN N'Resolved' THEN 3 ELSE 4 END";

export async function createHelpRequest(userId: number, input: { journeyTaskId: number; subject: string; problemDescription: string }) {
  const owned = await queryOne<{ JourneyTaskID: number }>(
    `SELECT jt.JourneyTaskID FROM dbo.Journey_Tasks jt JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
      WHERE jt.JourneyTaskID = @id AND j.UserID = @userId`,
    { id: [sql.Int, input.journeyTaskId], userId: [sql.Int, userId] },
  );
  if (!owned) throw new AppError("errors.taskNotFound", undefined, "notFound");

  const row = await queryOne<{ RequestID: number }>(
    `INSERT INTO dbo.Help_Requests (JourneyTaskID, Subject, ProblemDescription) VALUES (@id, @subject, @description);
     SELECT CONVERT(INT, SCOPE_IDENTITY()) AS RequestID;`,
    { id: [sql.Int, input.journeyTaskId], subject: [sql.NVarChar(200), input.subject], description: [sql.NVarChar(2000), input.problemDescription] },
  );
  return row!.RequestID;
}

export function listStudentRequests(userId: number, locale: Locale, journeyTaskId?: number) {
  return query<HelpRequestRow>(
    `${REQUEST_SELECT} WHERE j.UserID = @userId AND (@journeyTaskId IS NULL OR hr.JourneyTaskID = @journeyTaskId)
     ORDER BY ${STATUS_ORDER}, hr.CreatedAt DESC`,
    { userId: [sql.Int, userId], journeyTaskId: [sql.Int, journeyTaskId ?? null], lang: [sql.Char(2), locale] },
  );
}

async function ownedRequestStatus(userId: number, requestId: number) {
  const row = await queryOne<{ RequestStatus: RequestStatus }>(
    `SELECT hr.RequestStatus FROM dbo.Help_Requests hr
       JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = hr.JourneyTaskID
       JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
      WHERE hr.RequestID = @requestId AND j.UserID = @userId`,
    { requestId: [sql.Int, requestId], userId: [sql.Int, userId] },
  );
  if (!row) throw new AppError("errors.requestNotFound", undefined, "notFound");
  return row.RequestStatus;
}

// Uses the course delete procedure, which only removes open, unassigned requests.
export async function withdrawRequest(userId: number, requestId: number) {
  await ownedRequestStatus(userId, requestId);
  await procedure("dbo.usp_HelpRequest_DeleteOpen", { RequestID: [sql.Int, requestId] });
}

export async function closeOwnRequest(userId: number, requestId: number) {
  const status = await ownedRequestStatus(userId, requestId);
  if (status !== "Resolved") throw new AppError("errors.onlyResolvedClosable");
  await execute("UPDATE dbo.Help_Requests SET RequestStatus = N'Closed' WHERE RequestID = @requestId", { requestId: [sql.Int, requestId] });
}

export function listMentorRequests(mentorUserId: number, locale: Locale) {
  return query<MentorRequestRow>(`${REQUEST_SELECT} WHERE hr.MentorUserID = @mentorId ORDER BY ${STATUS_ORDER}, hr.CreatedAt`, {
    mentorId: [sql.Int, mentorUserId],
    lang: [sql.Char(2), locale],
  });
}

export function getMentorRequest(mentorUserId: number, requestId: number, locale: Locale) {
  return queryOne<MentorRequestRow>(`${REQUEST_SELECT} WHERE hr.MentorUserID = @mentorId AND hr.RequestID = @requestId`, {
    mentorId: [sql.Int, mentorUserId],
    requestId: [sql.Int, requestId],
    lang: [sql.Char(2), locale],
  });
}

// Mentors resolve only requests assigned to them; admins may resolve any request.
export async function resolveRequest(actor: { id: number; isAdmin: boolean }, requestId: number, resolutionText: string) {
  const affected = await execute(
    `UPDATE dbo.Help_Requests
        SET RequestStatus = N'Resolved', ResolutionText = @text, ResolvedAt = SYSUTCDATETIME()
      WHERE RequestID = @requestId AND RequestStatus IN (N'Open', N'Assigned')
        AND (@isAdmin = 1 OR MentorUserID = @actorId)`,
    { text: [sql.NVarChar(2000), resolutionText], requestId: [sql.Int, requestId], isAdmin: [sql.Bit, actor.isAdmin], actorId: [sql.Int, actor.id] },
  );
  if (affected === 0) throw new AppError("errors.notOpenForYou", undefined, "forbidden");
}

export function listAllRequests(locale: Locale, status?: RequestStatus) {
  return query<MentorRequestRow>(`${REQUEST_SELECT} WHERE (@status IS NULL OR hr.RequestStatus = @status) ORDER BY ${STATUS_ORDER}, hr.CreatedAt`, {
    status: [sql.NVarChar(20), status ?? null],
    lang: [sql.Char(2), locale],
  });
}

// trg_HelpRequests_ValidateMentor rejects inactive or non-mentor accounts (51002).
export async function assignMentor(requestId: number, mentorUserId: number) {
  const affected = await execute(
    `UPDATE dbo.Help_Requests SET MentorUserID = @mentorId, RequestStatus = N'Assigned'
      WHERE RequestID = @requestId AND RequestStatus IN (N'Open', N'Assigned')`,
    { mentorId: [sql.Int, mentorUserId], requestId: [sql.Int, requestId] },
  );
  if (affected === 0) throw new AppError("errors.onlyOpenAssignable");
}
