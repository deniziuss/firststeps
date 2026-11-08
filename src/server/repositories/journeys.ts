import "server-only";
import type { JourneyProfile, TemplateRule } from "@/domain/journeyEngine";
import { planReconciliation } from "@/domain/reconcile";
import type { AccommodationStatus, JourneyStatus, ProgramType, TaskStatus } from "@/domain/statuses";
import { execute, procedure, query, queryOne, sql, withTransaction } from "../db";
import { AppError } from "../errors";

export type University = { UniversityID: number; UniversityName: string; City: string; Country: string; CountryCode: string; Website: string | null };

export type JourneySummary = {
  JourneyID: number;
  UniversityID: number;
  UniversityName: string;
  City: string;
  Country: string;
  ArrivalDate: Date;
  ProgramType: ProgramType;
  AccommodationStatus: AccommodationStatus;
  JourneyStatus: JourneyStatus;
  HomeCountryCode: string | null;
  CreatedAt: Date;
  DaysToArrival: number;
};

export function listUniversities() {
  return query<University>("SELECT UniversityID, UniversityName, City, Country, CountryCode, Website FROM dbo.Universities ORDER BY Country, City, UniversityName");
}

const JOURNEY_SELECT = `
  SELECT j.JourneyID, j.UniversityID, u.UniversityName, u.City, u.Country, j.ArrivalDate, j.ProgramType,
         j.AccommodationStatus, j.JourneyStatus, j.HomeCountryCode, j.CreatedAt,
         DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), j.ArrivalDate) AS DaysToArrival
    FROM dbo.Journeys j
    JOIN dbo.Universities u ON u.UniversityID = j.UniversityID`;

export function listJourneys(userId: number) {
  return query<JourneySummary>(`${JOURNEY_SELECT} WHERE j.UserID = @userId ORDER BY j.ArrivalDate DESC`, { userId: [sql.Int, userId] });
}

// Ownership is part of the query: another student's journey id simply returns nothing.
export function getJourney(userId: number, journeyId: number) {
  return queryOne<JourneySummary>(`${JOURNEY_SELECT} WHERE j.UserID = @userId AND j.JourneyID = @journeyId`, {
    userId: [sql.Int, userId],
    journeyId: [sql.Int, journeyId],
  });
}

export async function createJourney(
  userId: number,
  input: { universityId: number; arrivalDate: string; programType: ProgramType; accommodationStatus: AccommodationStatus; homeCountryCode: string | null },
) {
  return withTransaction(async (tx) => {
    const { output } = await procedure(
      "dbo.usp_Journey_CreateWithTasks",
      {
        UserID: [sql.Int, userId],
        UniversityID: [sql.Int, input.universityId],
        ArrivalDate: [sql.Date, input.arrivalDate],
        ProgramType: [sql.NVarChar(20), input.programType],
        AccommodationStatus: [sql.NVarChar(20), input.accommodationStatus],
      },
      { NewJourneyID: sql.Int },
      tx,
    );
    const journeyId = output.NewJourneyID as number;
    if (input.homeCountryCode) {
      await execute("UPDATE dbo.Journeys SET HomeCountryCode = @code WHERE JourneyID = @journeyId", {
        code: [sql.Char(2), input.homeCountryCode],
        journeyId: [sql.Int, journeyId],
      }, tx);
    }
    return journeyId;
  });
}

export function setJourneyStatus(userId: number, journeyId: number, status: JourneyStatus) {
  return execute("UPDATE dbo.Journeys SET JourneyStatus = @status WHERE JourneyID = @journeyId AND UserID = @userId", {
    status: [sql.NVarChar(20), status],
    journeyId: [sql.Int, journeyId],
    userId: [sql.Int, userId],
  });
}

type TemplateRow = { TaskID: number; UniversityID: number | null; ApplicableProgram: TemplateRule["applicableProgram"]; AccommodationCondition: TemplateRule["accommodationCondition"]; IsActive: boolean };

// Changes the accommodation status and re-plans the journey in one transaction.
// Completed tasks and existing rows are always kept (see domain/reconcile.ts).
export async function changeAccommodation(userId: number, journeyId: number, accommodationStatus: AccommodationStatus) {
  return withTransaction(async (tx) => {
    const journey = await queryOne<{ UniversityID: number; ProgramType: ProgramType }>(
      "SELECT UniversityID, ProgramType FROM dbo.Journeys WITH (UPDLOCK) WHERE JourneyID = @journeyId AND UserID = @userId",
      { journeyId: [sql.Int, journeyId], userId: [sql.Int, userId] },
      tx,
    );
    if (!journey) throw new AppError("errors.journeyNotFound", undefined, "notFound");

    await execute("UPDATE dbo.Journeys SET AccommodationStatus = @status WHERE JourneyID = @journeyId", {
      status: [sql.NVarChar(20), accommodationStatus],
      journeyId: [sql.Int, journeyId],
    }, tx);

    const templates = (await query<TemplateRow>("SELECT TaskID, UniversityID, ApplicableProgram, AccommodationCondition, IsActive FROM dbo.Task_Templates", {}, tx)).map(
      (t): TemplateRule => ({ taskId: t.TaskID, universityId: t.UniversityID, applicableProgram: t.ApplicableProgram, accommodationCondition: t.AccommodationCondition, isActive: t.IsActive }),
    );
    const existing = (await query<{ JourneyTaskID: number; TaskID: number; TaskStatus: TaskStatus }>(
      "SELECT JourneyTaskID, TaskID, TaskStatus FROM dbo.Journey_Tasks WHERE JourneyID = @journeyId",
      { journeyId: [sql.Int, journeyId] },
      tx,
    )).map((t) => ({ journeyTaskId: t.JourneyTaskID, taskId: t.TaskID, status: t.TaskStatus }));

    const profile: JourneyProfile = { universityId: journey.UniversityID, programType: journey.ProgramType, accommodationStatus };
    const plan = planReconciliation(templates, existing, profile);

    for (const taskId of plan.add) {
      await execute("INSERT INTO dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus) VALUES (@journeyId, @taskId, N'Pending')", {
        journeyId: [sql.Int, journeyId],
        taskId: [sql.Int, taskId],
      }, tx);
    }
    for (const journeyTaskId of plan.markNotApplicable) {
      await execute("UPDATE dbo.Journey_Tasks SET TaskStatus = N'NotApplicable', CompletedAt = NULL WHERE JourneyTaskID = @id", { id: [sql.Int, journeyTaskId] }, tx);
    }
    for (const journeyTaskId of plan.reopen) {
      await execute("UPDATE dbo.Journey_Tasks SET TaskStatus = N'Pending' WHERE JourneyTaskID = @id", { id: [sql.Int, journeyTaskId] }, tx);
    }
    return { added: plan.add.length, retired: plan.markNotApplicable.length, reopened: plan.reopen.length };
  });
}
