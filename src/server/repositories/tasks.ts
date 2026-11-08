import "server-only";
import { checkTransition, unmetPrerequisites, type Dependency, type UnmetPrerequisite } from "@/domain/prerequisites";
import type { JourneyStage, SourceStatus, StudentTaskStatus, TaskStatus } from "@/domain/statuses";
import { procedure, query, queryOne, sql, withTransaction } from "../db";
import { AppError } from "../errors";

export type JourneyTaskRow = {
  JourneyTaskID: number;
  JourneyID: number;
  TaskID: number;
  TaskStatus: TaskStatus;
  DueDate: Date | null;
  CompletedAt: Date | null;
  TaskTitle: string;
  Description: string | null;
  Category: string;
  JourneyStage: JourneyStage;
  Priority: number;
  VerifiedSources: number;
  TotalSources: number;
};

export type JourneyTaskView = JourneyTaskRow & { unmet: (UnmetPrerequisite & { title: string })[] };

export type SourceRow = { SourceID: number; SourceTitle: string; SourceURL: string | null; SourceStatus: SourceStatus; LastVerifiedAt: Date | null };

const STAGE_ORDER = "CASE t.JourneyStage WHEN N'BeforeArrival' THEN 1 WHEN N'FirstDays' THEN 2 WHEN N'FirstWeek' THEN 3 ELSE 4 END";

async function journeyTaskRows(journeyId: number, executor?: Parameters<typeof query>[2]) {
  return query<JourneyTaskRow>(
    `SELECT jt.JourneyTaskID, jt.JourneyID, jt.TaskID, jt.TaskStatus, jt.DueDate, jt.CompletedAt,
            t.TaskTitle, t.Description, t.Category, t.JourneyStage, t.Priority,
            (SELECT COUNT(*) FROM dbo.Information_Sources s WHERE s.TaskID = t.TaskID AND s.SourceStatus = N'Verified') AS VerifiedSources,
            (SELECT COUNT(*) FROM dbo.Information_Sources s WHERE s.TaskID = t.TaskID) AS TotalSources
       FROM dbo.Journey_Tasks jt
       JOIN dbo.Task_Templates t ON t.TaskID = jt.TaskID
      WHERE jt.JourneyID = @journeyId
      ORDER BY ${STAGE_ORDER}, t.Priority, t.TaskTitle`,
    { journeyId: [sql.Int, journeyId] },
    executor,
  );
}

// Dependencies of every task in the journey, including prerequisites that are not part of it.
async function journeyDependencies(journeyId: number, executor?: Parameters<typeof query>[2]) {
  const rows = await query<{ TaskID: number; RequiredTaskID: number; RequiredTitle: string }>(
    `SELECT d.TaskID, d.RequiredTaskID, r.TaskTitle AS RequiredTitle
       FROM dbo.Task_Dependencies d
       JOIN dbo.Task_Templates r ON r.TaskID = d.RequiredTaskID
      WHERE d.TaskID IN (SELECT TaskID FROM dbo.Journey_Tasks WHERE JourneyID = @journeyId)`,
    { journeyId: [sql.Int, journeyId] },
    executor,
  );
  return {
    dependencies: rows.map((r): Dependency => ({ taskId: r.TaskID, requiredTaskId: r.RequiredTaskID })),
    titles: new Map(rows.map((r) => [r.RequiredTaskID, r.RequiredTitle])),
  };
}

// Caller must have verified that the journey belongs to the user.
export async function listJourneyTasks(journeyId: number): Promise<JourneyTaskView[]> {
  const [rows, { dependencies, titles }] = await Promise.all([journeyTaskRows(journeyId), journeyDependencies(journeyId)]);
  const states = rows.map((r) => ({ taskId: r.TaskID, status: r.TaskStatus }));
  return rows.map((row) => ({
    ...row,
    unmet: row.TaskStatus === "Completed" ? [] : unmetPrerequisites(row.TaskID, states, dependencies).map((u) => ({ ...u, title: titles.get(u.requiredTaskId) ?? "Unknown task" })),
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

export async function getTaskDetail(userId: number, journeyTaskId: number): Promise<TaskDetail | undefined> {
  const owner = await queryOne<{ JourneyID: number; UserID: number; UniversityName: string; City: string }>(
    `SELECT j.JourneyID, j.UserID, u.UniversityName, u.City
       FROM dbo.Journey_Tasks jt
       JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
       JOIN dbo.Universities u ON u.UniversityID = j.UniversityID
      WHERE jt.JourneyTaskID = @id AND j.UserID = @userId`,
    { id: [sql.Int, journeyTaskId], userId: [sql.Int, userId] },
  );
  if (!owner) return undefined;

  const tasks = await listJourneyTasks(owner.JourneyID);
  const task = tasks.find((t) => t.JourneyTaskID === journeyTaskId)!;
  const byTemplate = new Map(tasks.map((t) => [t.TaskID, t]));

  const [sources, prereqRows, dependentRows] = await Promise.all([
    listSourcesForTask(task.TaskID),
    query<{ TaskID: number; TaskTitle: string }>(
      "SELECT t.TaskID, t.TaskTitle FROM dbo.Task_Dependencies d JOIN dbo.Task_Templates t ON t.TaskID = d.RequiredTaskID WHERE d.TaskID = @taskId ORDER BY t.TaskTitle",
      { taskId: [sql.Int, task.TaskID] },
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

export function listSourcesForTask(taskId: number) {
  return query<SourceRow>(
    `SELECT SourceID, SourceTitle, SourceURL, SourceStatus, LastVerifiedAt FROM dbo.Information_Sources
      WHERE TaskID = @taskId ORDER BY CASE SourceStatus WHEN N'Verified' THEN 1 WHEN N'PendingReview' THEN 2 ELSE 3 END, SourceTitle`,
    { taskId: [sql.Int, taskId] },
  );
}

// Open tasks in priority order, produced by the course cursor procedure.
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
export async function updateTaskStatus(userId: number, journeyTaskId: number, status: StudentTaskStatus) {
  return withTransaction(async (tx) => {
    const target = await queryOne<{ JourneyID: number; TaskID: number; TaskStatus: TaskStatus }>(
      `SELECT jt.JourneyID, jt.TaskID, jt.TaskStatus
         FROM dbo.Journey_Tasks jt WITH (UPDLOCK)
         JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
        WHERE jt.JourneyTaskID = @id AND j.UserID = @userId`,
      { id: [sql.Int, journeyTaskId], userId: [sql.Int, userId] },
      tx,
    );
    if (!target) throw new AppError("Task not found.", "notFound");
    if (target.TaskStatus === "NotApplicable") throw new AppError("This task does not apply to your journey.");
    if (target.TaskStatus === status) return;

    const rows = await journeyTaskRows(target.JourneyID, tx);
    const { dependencies, titles } = await journeyDependencies(target.JourneyID, tx);
    const states = rows.map((r) => ({ taskId: r.TaskID, status: r.TaskStatus }));
    const check = checkTransition(target.TaskID, target.TaskStatus, status, states, dependencies);

    if (!check.ok && check.code === "prerequisites") {
      const names = check.unmet.map((u) => titles.get(u.requiredTaskId) ?? "a prerequisite").join(", ");
      throw new AppError(`Complete these tasks first: ${names}.`);
    }
    if (!check.ok && check.code === "dependents") {
      const names = check.dependentTaskIds.map((id) => rows.find((r) => r.TaskID === id)?.TaskTitle ?? "a later task").join(", ");
      throw new AppError(`Reopen the tasks that depend on this one first: ${names}.`);
    }

    await procedure("dbo.usp_JourneyTask_UpdateStatus", { JourneyTaskID: [sql.Int, journeyTaskId], NewStatus: [sql.NVarChar(20), status] }, {}, tx);
  });
}
