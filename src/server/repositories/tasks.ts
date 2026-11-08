import "server-only";
import { checkTransition, unmetPrerequisites, type Dependency, type UnmetPrerequisite } from "@/domain/prerequisites";
import type { JourneyStage, SourceStatus, StudentTaskStatus, TaskStatus } from "@/domain/statuses";
import type { Locale } from "@/i18n/config";
import { procedure, query, queryOne, sql, withTransaction } from "../db";
import { AppError } from "../errors";
import { localizedTask, localizedTitle } from "./localized";

export type JourneyTaskRow = {
  JourneyTaskID: number;
  JourneyID: number;
  TaskID: number;
  TaskStatus: TaskStatus;
  DueDate: Date | null;
  CompletedAt: Date | null;
  BaseTitle: string; // English source title
  TaskTitle: string; // in the requested language, English when no translation exists
  Description: string | null;
  IsFallback: boolean; // true when the requested language had no translation
  Category: string;
  JourneyStage: JourneyStage;
  Priority: number;
  VerifiedSources: number;
  TotalSources: number;
};

export type JourneyTaskView = JourneyTaskRow & { unmet: (UnmetPrerequisite & { title: string })[] };

export type SourceRow = { SourceID: number; SourceTitle: string; SourceURL: string | null; SourceStatus: SourceStatus; LastVerifiedAt: Date | null };

type Executor = Parameters<typeof query>[2];

const STAGE_ORDER = "CASE t.JourneyStage WHEN N'BeforeArrival' THEN 1 WHEN N'FirstDays' THEN 2 WHEN N'FirstWeek' THEN 3 ELSE 4 END";

async function journeyTaskRows(journeyId: number, locale: Locale, executor?: Executor) {
  return query<JourneyTaskRow>(
    `SELECT jt.JourneyTaskID, jt.JourneyID, jt.TaskID, jt.TaskStatus, jt.DueDate, jt.CompletedAt,
            t.TaskTitle AS BaseTitle, ${localizedTask("t", "tt")}, t.Category, t.JourneyStage, t.Priority,
            (SELECT COUNT(*) FROM dbo.Information_Sources s WHERE s.TaskID = t.TaskID AND s.SourceStatus = N'Verified') AS VerifiedSources,
            (SELECT COUNT(*) FROM dbo.Information_Sources s WHERE s.TaskID = t.TaskID) AS TotalSources
       FROM dbo.Journey_Tasks jt
       JOIN dbo.Task_Templates t ON t.TaskID = jt.TaskID
       LEFT JOIN dbo.Task_Template_Translations tt ON tt.TaskID = t.TaskID AND tt.LanguageCode = @lang
      WHERE jt.JourneyID = @journeyId
      ORDER BY ${STAGE_ORDER}, t.Priority, t.TaskTitle`,
    { journeyId: [sql.Int, journeyId], lang: [sql.Char(2), locale] },
    executor,
  );
}

// Dependencies of every task in the journey, including prerequisites that are not part of it.
async function journeyDependencies(journeyId: number, locale: Locale, executor?: Executor) {
  const rows = await query<{ TaskID: number; RequiredTaskID: number; RequiredTitle: string }>(
    `SELECT d.TaskID, d.RequiredTaskID, ${localizedTitle("r", "tt")} AS RequiredTitle
       FROM dbo.Task_Dependencies d
       JOIN dbo.Task_Templates r ON r.TaskID = d.RequiredTaskID
       LEFT JOIN dbo.Task_Template_Translations tt ON tt.TaskID = r.TaskID AND tt.LanguageCode = @lang
      WHERE d.TaskID IN (SELECT TaskID FROM dbo.Journey_Tasks WHERE JourneyID = @journeyId)`,
    { journeyId: [sql.Int, journeyId], lang: [sql.Char(2), locale] },
    executor,
  );
  return {
    dependencies: rows.map((r): Dependency => ({ taskId: r.TaskID, requiredTaskId: r.RequiredTaskID })),
    titles: new Map(rows.map((r) => [r.RequiredTaskID, r.RequiredTitle])),
  };
}

// Caller must have verified that the journey belongs to the user.
export async function listJourneyTasks(journeyId: number, locale: Locale): Promise<JourneyTaskView[]> {
  const [rows, { dependencies, titles }] = await Promise.all([journeyTaskRows(journeyId, locale), journeyDependencies(journeyId, locale)]);
  const states = rows.map((r) => ({ taskId: r.TaskID, status: r.TaskStatus }));
  return rows.map((row) => ({
    ...row,
    unmet: row.TaskStatus === "Completed" ? [] : unmetPrerequisites(row.TaskID, states, dependencies).map((u) => ({ ...u, title: titles.get(u.requiredTaskId) ?? "?" })),
  }));
}

export type TaskDetail = JourneyTaskView & {
  UserID: number;
  UniversityName: string;
  City: string;
  sources: SourceRow[];
  prerequisites: { taskId: number; title: string; status: TaskStatus | null; journeyTaskId: number | null }[];
  dependents: { taskId: number; title: string; status: TaskStatus; journeyTaskId: number }[];
};

export async function getTaskDetail(userId: number, journeyTaskId: number, locale: Locale): Promise<TaskDetail | undefined> {
  const owner = await queryOne<{ JourneyID: number; UserID: number; UniversityName: string; City: string }>(
    `SELECT j.JourneyID, j.UserID, u.UniversityName, u.City
       FROM dbo.Journey_Tasks jt
       JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
       JOIN dbo.Universities u ON u.UniversityID = j.UniversityID
      WHERE jt.JourneyTaskID = @id AND j.UserID = @userId`,
    { id: [sql.Int, journeyTaskId], userId: [sql.Int, userId] },
  );
  if (!owner) return undefined;

  const tasks = await listJourneyTasks(owner.JourneyID, locale);
  const task = tasks.find((t) => t.JourneyTaskID === journeyTaskId)!;
  const byTemplate = new Map(tasks.map((t) => [t.TaskID, t]));

  const [sources, prereqRows, dependentRows] = await Promise.all([
    listSourcesForTask(task.TaskID, locale),
    query<{ TaskID: number; TaskTitle: string }>(
      `SELECT t.TaskID, ${localizedTitle("t", "tt")} AS TaskTitle
         FROM dbo.Task_Dependencies d
         JOIN dbo.Task_Templates t ON t.TaskID = d.RequiredTaskID
         LEFT JOIN dbo.Task_Template_Translations tt ON tt.TaskID = t.TaskID AND tt.LanguageCode = @lang
        WHERE d.TaskID = @taskId
        ORDER BY TaskTitle`,
      { taskId: [sql.Int, task.TaskID], lang: [sql.Char(2), locale] },
    ),
    query<{ TaskID: number }>("SELECT TaskID FROM dbo.Task_Dependencies WHERE RequiredTaskID = @taskId", { taskId: [sql.Int, task.TaskID] }),
  ]);

  return {
    ...task,
    UserID: owner.UserID,
    UniversityName: owner.UniversityName,
    City: owner.City,
    sources,
    prerequisites: prereqRows.map((p) => ({
      taskId: p.TaskID,
      title: p.TaskTitle,
      status: byTemplate.get(p.TaskID)?.TaskStatus ?? null,
      journeyTaskId: byTemplate.get(p.TaskID)?.JourneyTaskID ?? null,
    })),
    dependents: dependentRows
      .map((d) => byTemplate.get(d.TaskID))
      .filter((t) => t !== undefined)
      .map((t) => ({ taskId: t.TaskID, title: t.TaskTitle, status: t.TaskStatus, journeyTaskId: t.JourneyTaskID })),
  };
}

export function listSourcesForTask(taskId: number, locale: Locale) {
  return query<SourceRow>(
    `SELECT s.SourceID, COALESCE(st.SourceTitle, s.SourceTitle) AS SourceTitle, s.SourceURL, s.SourceStatus, s.LastVerifiedAt
       FROM dbo.Information_Sources s
       LEFT JOIN dbo.Information_Source_Translations st ON st.SourceID = s.SourceID AND st.LanguageCode = @lang
      WHERE s.TaskID = @taskId
      ORDER BY CASE s.SourceStatus WHEN N'Verified' THEN 1 WHEN N'PendingReview' THEN 2 ELSE 3 END, SourceTitle`,
    { taskId: [sql.Int, taskId], lang: [sql.Char(2), locale] },
  );
}

// Open tasks in priority order, produced by the course cursor procedure (English titles).
// Caller must have verified that the journey belongs to the user.
export async function pendingTaskReport(journeyId: number) {
  const { rows } = await procedure<{ TaskNumber: number; TaskTitle: string; TaskStatus: TaskStatus }>(
    "dbo.usp_Journey_PendingTaskCursorReport",
    { JourneyID: [sql.Int, journeyId] },
  );
  return rows;
}

// Checks the dependency rules in the application first (clear messages), then lets the course
// procedure and triggers enforce them again in the database.
export async function updateTaskStatus(userId: number, journeyTaskId: number, status: StudentTaskStatus, locale: Locale) {
  return withTransaction(async (tx) => {
    const target = await queryOne<{ JourneyID: number; TaskID: number; TaskStatus: TaskStatus }>(
      `SELECT jt.JourneyID, jt.TaskID, jt.TaskStatus
         FROM dbo.Journey_Tasks jt WITH (UPDLOCK)
         JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
        WHERE jt.JourneyTaskID = @id AND j.UserID = @userId`,
      { id: [sql.Int, journeyTaskId], userId: [sql.Int, userId] },
      tx,
    );
    if (!target) throw new AppError("errors.taskNotFound", undefined, "notFound");
    if (target.TaskStatus === "NotApplicable") throw new AppError("errors.notApplicable");
    if (target.TaskStatus === status) return;

    const rows = await journeyTaskRows(target.JourneyID, locale, tx);
    const { dependencies, titles } = await journeyDependencies(target.JourneyID, locale, tx);
    const states = rows.map((r) => ({ taskId: r.TaskID, status: r.TaskStatus }));
    const check = checkTransition(target.TaskID, target.TaskStatus, status, states, dependencies);

    if (!check.ok && check.code === "prerequisites") {
      throw new AppError("errors.prerequisitesFirst", { tasks: check.unmet.map((u) => titles.get(u.requiredTaskId) ?? "?").join(", ") });
    }
    if (!check.ok && check.code === "dependents") {
      const names = check.dependentTaskIds.map((id) => rows.find((r) => r.TaskID === id)?.TaskTitle ?? "?").join(", ");
      throw new AppError("errors.dependentsFirst", { tasks: names });
    }

    await procedure("dbo.usp_JourneyTask_UpdateStatus", { JourneyTaskID: [sql.Int, journeyTaskId], NewStatus: [sql.NVarChar(20), status] }, {}, tx);
  });
}
