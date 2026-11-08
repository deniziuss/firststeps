import "server-only";
import type { Dependency } from "@/domain/prerequisites";
import type { AccommodationCondition, ApplicableProgram, JourneyStage, SourceStatus } from "@/domain/statuses";
import { execute, query, queryOne, sql, withTransaction, type Params } from "../db";
import { AppError } from "../errors";

export type TemplateRow = {
  TaskID: number;
  UniversityID: number | null;
  UniversityName: string | null;
  TaskTitle: string;
  Description: string | null;
  Category: string;
  JourneyStage: JourneyStage;
  ApplicableProgram: ApplicableProgram;
  AccommodationCondition: AccommodationCondition;
  Priority: number;
  IsActive: boolean;
  SourceCount: number;
  DependencyCount: number;
  UsageCount: number;
  TitleTr: string | null;
  DescriptionTr: string | null;
};

export type TemplateInput = {
  universityId: number | null;
  taskTitle: string;
  description: string | null;
  category: string;
  journeyStage: JourneyStage;
  applicableProgram: ApplicableProgram;
  accommodationCondition: AccommodationCondition;
  priority: number;
  isActive: boolean;
};

const TEMPLATE_SELECT = `
  SELECT t.TaskID, t.UniversityID, u.UniversityName, t.TaskTitle, t.Description, t.Category, t.JourneyStage,
         t.ApplicableProgram, t.AccommodationCondition, t.Priority, t.IsActive,
         (SELECT COUNT(*) FROM dbo.Information_Sources s WHERE s.TaskID = t.TaskID) AS SourceCount,
         (SELECT COUNT(*) FROM dbo.Task_Dependencies d WHERE d.TaskID = t.TaskID) AS DependencyCount,
         (SELECT COUNT(*) FROM dbo.Journey_Tasks jt WHERE jt.TaskID = t.TaskID) AS UsageCount,
         tt.TaskTitle AS TitleTr, tt.Description AS DescriptionTr
    FROM dbo.Task_Templates t
    LEFT JOIN dbo.Universities u ON u.UniversityID = t.UniversityID
    LEFT JOIN dbo.Task_Template_Translations tt ON tt.TaskID = t.TaskID AND tt.LanguageCode = 'tr'`;

// Turkish content for a template; English stays in Task_Templates.
export async function saveTemplateTranslation(taskId: number, title: string, description: string | null) {
  await execute(
    `MERGE dbo.Task_Template_Translations AS target
     USING (SELECT @taskId AS TaskID, 'tr' AS LanguageCode) AS source
        ON target.TaskID = source.TaskID AND target.LanguageCode = source.LanguageCode
      WHEN MATCHED THEN UPDATE SET TaskTitle = @title, Description = @description, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (TaskID, LanguageCode, TaskTitle, Description) VALUES (@taskId, 'tr', @title, @description);`,
    { taskId: [sql.Int, taskId], title: [sql.NVarChar(200), title], description: [sql.NVarChar(1000), description] },
  );
}

export function listTemplates() {
  return query<TemplateRow>(
    `${TEMPLATE_SELECT} ORDER BY CASE t.JourneyStage WHEN N'BeforeArrival' THEN 1 WHEN N'FirstDays' THEN 2 WHEN N'FirstWeek' THEN 3 ELSE 4 END, t.Priority, t.TaskTitle`,
  );
}

export function getTemplate(taskId: number) {
  return queryOne<TemplateRow>(`${TEMPLATE_SELECT} WHERE t.TaskID = @taskId`, { taskId: [sql.Int, taskId] });
}

function templateParams(input: TemplateInput): Params {
  return {
    universityId: [sql.Int, input.universityId],
    title: [sql.NVarChar(200), input.taskTitle],
    description: [sql.NVarChar(1000), input.description],
    category: [sql.NVarChar(60), input.category],
    stage: [sql.NVarChar(20), input.journeyStage],
    program: [sql.NVarChar(20), input.applicableProgram],
    accommodation: [sql.NVarChar(20), input.accommodationCondition],
    priority: [sql.TinyInt, input.priority],
    isActive: [sql.Bit, input.isActive],
  };
}

// Templates only affect journeys created or re-planned afterwards; existing journey tasks are untouched.
export async function createTemplate(input: TemplateInput) {
  const row = await queryOne<{ TaskID: number }>(
    `INSERT INTO dbo.Task_Templates (UniversityID, TaskTitle, Description, Category, JourneyStage, ApplicableProgram, AccommodationCondition, Priority, IsActive)
     VALUES (@universityId, @title, @description, @category, @stage, @program, @accommodation, @priority, @isActive);
     SELECT CONVERT(INT, SCOPE_IDENTITY()) AS TaskID;`,
    { ...templateParams(input) },
  );
  return row!.TaskID;
}

export async function updateTemplate(taskId: number, input: TemplateInput) {
  const affected = await execute(
    `UPDATE dbo.Task_Templates
        SET UniversityID = @universityId, TaskTitle = @title, Description = @description, Category = @category, JourneyStage = @stage,
            ApplicableProgram = @program, AccommodationCondition = @accommodation, Priority = @priority, IsActive = @isActive
      WHERE TaskID = @taskId`,
    { ...templateParams(input), taskId: [sql.Int, taskId] },
  );
  if (affected === 0) throw new AppError("errors.templateNotFound", undefined, "notFound");
}

export async function listAllDependencies() {
  const rows = await query<{ TaskID: number; RequiredTaskID: number }>("SELECT TaskID, RequiredTaskID FROM dbo.Task_Dependencies");
  return rows.map((r): Dependency => ({ taskId: r.TaskID, requiredTaskId: r.RequiredTaskID }));
}

export function listPrerequisites(taskId: number) {
  return query<TemplateRow>(`${TEMPLATE_SELECT} WHERE t.TaskID IN (SELECT RequiredTaskID FROM dbo.Task_Dependencies WHERE TaskID = @taskId) ORDER BY t.TaskTitle`, {
    taskId: [sql.Int, taskId],
  });
}

export function addDependency(taskId: number, requiredTaskId: number) {
  return execute("INSERT INTO dbo.Task_Dependencies (TaskID, RequiredTaskID) VALUES (@taskId, @requiredTaskId)", {
    taskId: [sql.Int, taskId],
    requiredTaskId: [sql.Int, requiredTaskId],
  });
}

export function removeDependency(taskId: number, requiredTaskId: number) {
  return execute("DELETE FROM dbo.Task_Dependencies WHERE TaskID = @taskId AND RequiredTaskID = @requiredTaskId", {
    taskId: [sql.Int, taskId],
    requiredTaskId: [sql.Int, requiredTaskId],
  });
}

export type SourceAdminRow = {
  SourceID: number;
  TaskID: number;
  TaskTitle: string;
  SourceTitle: string;
  SourceURL: string | null;
  SourceStatus: SourceStatus;
  LastVerifiedAt: Date | null;
  CreatedAt: Date;
};

export function listSources(filter: { taskId?: number; status?: SourceStatus }) {
  return query<SourceAdminRow>(
    `SELECT s.SourceID, s.TaskID, t.TaskTitle, s.SourceTitle, s.SourceURL, s.SourceStatus, s.LastVerifiedAt, s.CreatedAt
       FROM dbo.Information_Sources s JOIN dbo.Task_Templates t ON t.TaskID = s.TaskID
      WHERE (@taskId IS NULL OR s.TaskID = @taskId) AND (@status IS NULL OR s.SourceStatus = @status)
      ORDER BY CASE s.SourceStatus WHEN N'PendingReview' THEN 1 WHEN N'Outdated' THEN 2 ELSE 3 END, s.LastVerifiedAt, t.TaskTitle`,
    { taskId: [sql.Int, filter.taskId ?? null], status: [sql.NVarChar(20), filter.status ?? null] },
  );
}

export function createSource(input: { taskId: number; sourceTitle: string; sourceTitleTr: string | null; sourceUrl: string | null; sourceStatus: SourceStatus }) {
  return withTransaction(async (tx) => {
    const row = await queryOne<{ SourceID: number }>(
      `INSERT INTO dbo.Information_Sources (TaskID, SourceTitle, SourceURL, SourceStatus, LastVerifiedAt)
       VALUES (@taskId, @title, @url, @status, CASE WHEN @status = N'Verified' THEN SYSUTCDATETIME() END);
       SELECT CONVERT(INT, SCOPE_IDENTITY()) AS SourceID;`,
      {
        taskId: [sql.Int, input.taskId],
        title: [sql.NVarChar(200), input.sourceTitle],
        url: [sql.NVarChar(1000), input.sourceUrl],
        status: [sql.NVarChar(20), input.sourceStatus],
      },
      tx,
    );
    if (input.sourceTitleTr) {
      await execute(
        "INSERT INTO dbo.Information_Source_Translations (SourceID, LanguageCode, SourceTitle) VALUES (@sourceId, 'tr', @title)",
        { sourceId: [sql.Int, row!.SourceID], title: [sql.NVarChar(200), input.sourceTitleTr] },
        tx,
      );
    }
  });
}

// Marking a source Verified records the review time; other statuses keep the last verification date.
export async function setSourceStatus(sourceId: number, status: SourceStatus) {
  const affected = await execute(
    `UPDATE dbo.Information_Sources
        SET SourceStatus = @status, LastVerifiedAt = CASE WHEN @status = N'Verified' THEN SYSUTCDATETIME() ELSE LastVerifiedAt END
      WHERE SourceID = @sourceId`,
    { sourceId: [sql.Int, sourceId], status: [sql.NVarChar(20), status] },
  );
  if (affected === 0) throw new AppError("errors.sourceNotFound", undefined, "notFound");
}

export function deleteSource(sourceId: number) {
  return execute("DELETE FROM dbo.Information_Sources WHERE SourceID = @sourceId", { sourceId: [sql.Int, sourceId] });
}

export function createUniversity(input: { universityName: string; city: string; country: string; countryCode: string; website: string | null }) {
  return execute(
    "INSERT INTO dbo.Universities (UniversityName, City, Country, CountryCode, Website) VALUES (@name, @city, @country, @code, @website)",
    {
      name: [sql.NVarChar(200), input.universityName],
      city: [sql.NVarChar(100), input.city],
      country: [sql.NVarChar(100), input.country],
      code: [sql.Char(2), input.countryCode],
      website: [sql.NVarChar(500), input.website],
    },
  );
}

export async function updateUniversity(universityId: number, input: { universityName: string; city: string; country: string; countryCode: string; website: string | null }) {
  const affected = await execute(
    "UPDATE dbo.Universities SET UniversityName = @name, City = @city, Country = @country, CountryCode = @code, Website = @website WHERE UniversityID = @id",
    {
      id: [sql.Int, universityId],
      name: [sql.NVarChar(200), input.universityName],
      city: [sql.NVarChar(100), input.city],
      country: [sql.NVarChar(100), input.country],
      code: [sql.Char(2), input.countryCode],
      website: [sql.NVarChar(500), input.website],
    },
  );
  if (affected === 0) throw new AppError("errors.universityNotFound", undefined, "notFound");
}

export function universityUsage() {
  return query<{ UniversityID: number; Journeys: number; Templates: number }>(
    `SELECT u.UniversityID,
            (SELECT COUNT(*) FROM dbo.Journeys j WHERE j.UniversityID = u.UniversityID) AS Journeys,
            (SELECT COUNT(*) FROM dbo.Task_Templates t WHERE t.UniversityID = u.UniversityID) AS Templates
       FROM dbo.Universities u`,
  );
}

// Aggregates only: no names, emails or free text, so reports stay anonymous.
export async function systemStats() {
  const [counts, taskStatus, requestStatus, sourceStatus, usersByRole, programs, stageCompletion, stuckTasks] = await Promise.all([
    queryOne<{ Students: number; Journeys: number; ActiveJourneys: number; Templates: number; ActiveTemplates: number; Universities: number; AvgResolveHours: number | null }>(
      `SELECT (SELECT COUNT(*) FROM dbo.Users WHERE UserRole = N'Student') AS Students,
              (SELECT COUNT(*) FROM dbo.Journeys) AS Journeys,
              (SELECT COUNT(*) FROM dbo.Journeys WHERE JourneyStatus IN (N'Planning', N'Active')) AS ActiveJourneys,
              (SELECT COUNT(*) FROM dbo.Task_Templates) AS Templates,
              (SELECT COUNT(*) FROM dbo.Task_Templates WHERE IsActive = 1) AS ActiveTemplates,
              (SELECT COUNT(*) FROM dbo.Universities) AS Universities,
              (SELECT AVG(CAST(DATEDIFF(MINUTE, CreatedAt, ResolvedAt) AS FLOAT)) / 60 FROM dbo.Help_Requests WHERE ResolvedAt IS NOT NULL) AS AvgResolveHours`,
    ),
    query<{ Status: string; Total: number }>("SELECT TaskStatus AS Status, COUNT(*) AS Total FROM dbo.Journey_Tasks GROUP BY TaskStatus"),
    query<{ Status: string; Total: number }>("SELECT RequestStatus AS Status, COUNT(*) AS Total FROM dbo.Help_Requests GROUP BY RequestStatus"),
    query<{ Status: string; Total: number }>("SELECT SourceStatus AS Status, COUNT(*) AS Total FROM dbo.Information_Sources GROUP BY SourceStatus"),
    query<{ Status: string; Total: number }>("SELECT UserRole AS Status, COUNT(*) AS Total FROM dbo.Users WHERE IsActive = 1 GROUP BY UserRole"),
    query<{ Status: string; Total: number }>("SELECT ProgramType AS Status, COUNT(*) AS Total FROM dbo.Journeys GROUP BY ProgramType"),
    query<{ Stage: JourneyStage; Completed: number; Applicable: number }>(
      `SELECT t.JourneyStage AS Stage,
              SUM(CASE WHEN jt.TaskStatus = N'Completed' THEN 1 ELSE 0 END) AS Completed,
              SUM(CASE WHEN jt.TaskStatus <> N'NotApplicable' THEN 1 ELSE 0 END) AS Applicable
         FROM dbo.Journey_Tasks jt JOIN dbo.Task_Templates t ON t.TaskID = jt.TaskID
        GROUP BY t.JourneyStage`,
    ),
    query<{ TaskTitle: string; Requests: number; Blocked: number }>(
      `SELECT TOP (8) t.TaskTitle,
              (SELECT COUNT(*) FROM dbo.Help_Requests hr JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = hr.JourneyTaskID WHERE jt.TaskID = t.TaskID) AS Requests,
              (SELECT COUNT(*) FROM dbo.Journey_Tasks jt WHERE jt.TaskID = t.TaskID AND jt.TaskStatus = N'Blocked') AS Blocked
         FROM dbo.Task_Templates t
        ORDER BY Requests DESC, Blocked DESC, t.TaskTitle`,
    ),
  ]);
  return { counts: counts!, taskStatus, requestStatus, sourceStatus, usersByRole, programs, stageCompletion, stuckTasks: stuckTasks.filter((s) => s.Requests > 0 || s.Blocked > 0) };
}
