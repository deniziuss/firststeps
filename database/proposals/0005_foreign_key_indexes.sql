/*
  PROPOSAL 0005: index on Help_Requests.JourneyTaskID (NOT APPLIED; requires approval)

  Measured with database/tests/0005_measure.sql on the disposable FirstSteps_RestoreTest database
  (synthetic: 5,000 students, 90,000 journey tasks, 20,000 help requests, 606 dependencies; one
  transaction, rolled back). Logical reads, without -> with the index:

    Help_Requests.JourneyTaskID (IX_HelpRequests_JourneyTask)              RECOMMENDED
      Q1 student's request list (help page)         418 -> 36   (clustered scan -> 18 index seeks)
      Q2 student's requests for one task (task page)  418 -> 2
      cost: one help-request insert                   4 -> 6
    Journey_Tasks.TaskID (IX_JourneyTasks_Task)                            NOT RECOMMENDED NOW
      only helps "is this template used" (203 -> 2 for an unused template), which the application
      never runs: templates are deactivated, not deleted.
      cost: creating one journey (18 task inserts)    126 -> 264 reads on Journey_Tasks
    Task_Dependencies.RequiredTaskID (IX_TaskDependencies_Required)        NOT NEEDED
      dependents lookup 4 -> 2 reads; the table stays small (hundreds of rows at most).

  With the pilot data (tens of rows) none of this is measurable; the recommendation is for growth.
  Rollback: DROP INDEX IX_HelpRequests_JourneyTask ON dbo.Help_Requests;  No data change.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HelpRequests_JourneyTask' AND object_id = OBJECT_ID(N'dbo.Help_Requests'))
    CREATE INDEX IX_HelpRequests_JourneyTask ON dbo.Help_Requests (JourneyTaskID);
GO
