/*
  PROPOSAL 0005: indexes on foreign keys that have none (NOT APPLIED; requires approval)

  Evidence (docs/performance.md): every other foreign key is covered by an index, these three
  are not. With the current pilot data (tens of rows) the effect is not measurable, so this is a
  scaling recommendation, not a measured fix:
    - Help_Requests.JourneyTaskID   student request lists join on it; deleting journey tasks checks it
    - Task_Dependencies.RequiredTaskID   "what depends on this task" lookups and the cycle check
    - Journey_Tasks.TaskID           "is this template used" checks and template deletion
  Rollback: DROP INDEX for each. No data change.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HelpRequests_JourneyTask')
    CREATE INDEX IX_HelpRequests_JourneyTask ON dbo.Help_Requests (JourneyTaskID);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TaskDependencies_Required')
    CREATE INDEX IX_TaskDependencies_Required ON dbo.Task_Dependencies (RequiredTaskID);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JourneyTasks_Task')
    CREATE INDEX IX_JourneyTasks_Task ON dbo.Journey_Tasks (TaskID);
GO
