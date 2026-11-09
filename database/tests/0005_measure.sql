/*
  Measurement for PROPOSAL 0005 (foreign-key indexes). Runs ONLY on a disposable database and changes
  nothing permanently: synthetic data, the measured queries, the three indexes and the second
  measurement all happen inside ONE transaction that is rolled back at the end.

    sqlcmd -S tcp:127.0.0.1,1433 -E -C -d FirstSteps_RestoreTest -i database/tests/0005_measure.sql

  Synthetic workload (larger than the pilot, to see how the queries scale):
    5,000 students with one journey each, 18 journey tasks per journey (90,000 rows), 20,000 help
    requests, 300 extra templates with 600 dependencies.
  Measured with SET STATISTICS IO (logical reads) and the plan operator on the table in question,
  before and after creating the three indexes (OPTION (RECOMPILE) so each run gets a fresh plan):
    Q1  student's request list            (help.ts listStudentRequests, all tasks)
    Q2  student's requests for one task   (help.ts listStudentRequests, one JourneyTaskID)
    Q3  templates that depend on a task   (tasks.ts: Task_Dependencies WHERE RequiredTaskID = @t)
    Q4  is a template used by a journey   (FK check when a template would be deleted)
    Q4b the same for an unused template   (worst case)
    W1  write cost: one new journey (18 journey-task inserts) and one help request
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() NOT IN (N'FirstSteps_RestoreTest', N'FirstSteps_Test') THROW 50000, 'Run on a disposable database only.', 1;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name IN (N'IX_HelpRequests_JourneyTask', N'IX_TaskDependencies_Required', N'IX_JourneyTasks_Task'))
  THROW 50001, 'The 0005 indexes already exist here; the "before" measurement would be wrong.', 1;

BEGIN TRANSACTION;

DECLARE @uni INT = (SELECT MIN(UniversityID) FROM dbo.Universities);
DECLARE @stamp NVARCHAR(20) = CONVERT(NVARCHAR(20), SYSUTCDATETIME(), 112) + REPLACE(CONVERT(NVARCHAR(8), SYSUTCDATETIME(), 108), N':', N'');

-- 5,000 students and journeys
;WITH n AS (SELECT TOP (5000) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS i FROM sys.all_objects a CROSS JOIN sys.all_objects b)
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash)
SELECT N'Load', N'Test', CONCAT(N'qa+measure0005-', @stamp, N'-', i, N'@example.invalid'), N'x' FROM n;
INSERT dbo.Journeys (UserID, UniversityID, ArrivalDate, ProgramType, AccommodationStatus, JourneyStatus)
SELECT UserID, @uni, DATEADD(DAY, UserID % 300, '2027-01-01'), N'Erasmus', N'Confirmed', N'Active'
  FROM dbo.Users WHERE Email LIKE CONCAT(N'qa+measure0005-', @stamp, N'-%');

-- 18 tasks per journey (the existing templates), all Pending so the prerequisite trigger allows them
INSERT dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus)
SELECT j.JourneyID, t.TaskID, N'Pending'
  FROM dbo.Journeys j JOIN dbo.Users u ON u.UserID = j.UserID AND u.Email LIKE CONCAT(N'qa+measure0005-', @stamp, N'-%')
 CROSS JOIN (SELECT TOP (18) TaskID FROM dbo.Task_Templates ORDER BY TaskID) t;

-- 20,000 help requests on random journey tasks of those journeys
;WITH jt AS (
  SELECT jt.JourneyTaskID, ROW_NUMBER() OVER (ORDER BY CHECKSUM(NEWID())) AS r
    FROM dbo.Journey_Tasks jt JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
    JOIN dbo.Users u ON u.UserID = j.UserID AND u.Email LIKE CONCAT(N'qa+measure0005-', @stamp, N'-%'))
INSERT dbo.Help_Requests (JourneyTaskID, Subject, ProblemDescription)
SELECT JourneyTaskID, N'Load test', N'Synthetic request for the 0005 measurement' FROM jt WHERE r <= 20000;

-- 300 extra templates and 600 acyclic dependencies (each new template requires two earlier ones)
;WITH n AS (SELECT TOP (300) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS i FROM sys.all_objects)
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Description, Category, JourneyStage, ApplicableProgram, AccommodationCondition, Priority, IsActive)
SELECT TOP (300) t.UniversityID, CONCAT(N'Measure template ', n.i), t.Description, t.Category, t.JourneyStage, t.ApplicableProgram, t.AccommodationCondition, t.Priority, 0
  FROM n CROSS APPLY (SELECT TOP (1) * FROM dbo.Task_Templates ORDER BY TaskID) t;
INSERT dbo.Task_Dependencies (TaskID, RequiredTaskID)
SELECT t.TaskID, r.TaskID
  FROM dbo.Task_Templates t
 CROSS APPLY (SELECT TOP (2) p.TaskID FROM dbo.Task_Templates p WHERE p.TaskID < t.TaskID ORDER BY p.TaskID DESC) r
 WHERE t.TaskTitle LIKE N'Measure template %';

UPDATE STATISTICS dbo.Help_Requests;
UPDATE STATISTICS dbo.Journey_Tasks;
UPDATE STATISTICS dbo.Task_Dependencies;

SELECT CONCAT('rows: users=', (SELECT COUNT(*) FROM dbo.Users), ' journeyTasks=', (SELECT COUNT(*) FROM dbo.Journey_Tasks),
              ' helpRequests=', (SELECT COUNT(*) FROM dbo.Help_Requests), ' dependencies=', (SELECT COUNT(*) FROM dbo.Task_Dependencies)) AS info;

DECLARE @user INT = (SELECT MAX(j.UserID) FROM dbo.Journeys j JOIN dbo.Journey_Tasks jt ON jt.JourneyID = j.JourneyID JOIN dbo.Help_Requests h ON h.JourneyTaskID = jt.JourneyTaskID);
DECLARE @jtask INT = (SELECT MAX(h.JourneyTaskID) FROM dbo.Help_Requests h JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = h.JourneyTaskID JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID WHERE j.UserID = @user);
DECLARE @required INT = (SELECT MIN(TaskID) FROM dbo.Task_Templates WHERE TaskTitle LIKE N'Measure template %');
DECLARE @template INT = (SELECT MIN(TaskID) FROM dbo.Task_Templates);
DECLARE @pass INT = 1;
DECLARE @newUser INT = (SELECT MIN(UserID) FROM dbo.Users WHERE Email LIKE CONCAT(N'qa+measure0005-', @stamp, N'-%'));

WHILE @pass <= 2
BEGIN
  PRINT CONCAT('=== PASS ', @pass, IIF(@pass = 1, ' (without 0005 indexes)', ' (with 0005 indexes)'));
  SET STATISTICS IO ON;
  PRINT '--- Q1 student request list';
  SELECT COUNT(*) AS q1 FROM (
    SELECT hr.RequestID FROM dbo.Help_Requests hr
      JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = hr.JourneyTaskID
      JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
     WHERE j.UserID = @user) x OPTION (RECOMPILE);
  PRINT '--- Q2 requests for one task';
  SELECT COUNT(*) AS q2 FROM (
    SELECT hr.RequestID FROM dbo.Help_Requests hr
      JOIN dbo.Journey_Tasks jt ON jt.JourneyTaskID = hr.JourneyTaskID
      JOIN dbo.Journeys j ON j.JourneyID = jt.JourneyID
     WHERE j.UserID = @user AND hr.JourneyTaskID = @jtask) x OPTION (RECOMPILE);
  PRINT '--- Q3 dependents of a template';
  SELECT COUNT(*) AS q3 FROM dbo.Task_Dependencies WHERE RequiredTaskID = @required OPTION (RECOMPILE);
  PRINT '--- Q4 template used by a journey';
  SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Journey_Tasks WHERE TaskID = @template) THEN 1 ELSE 0 END AS q4 OPTION (RECOMPILE);
  PRINT '--- Q4b template NOT used by any journey (worst case: the whole table is checked)';
  SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Journey_Tasks WHERE TaskID = @required) THEN 1 ELSE 0 END AS q4b OPTION (RECOMPILE);
  PRINT '--- W1 new journey (18 tasks) and one help request';
  SAVE TRANSACTION w1;
  INSERT dbo.Journeys (UserID, UniversityID, ArrivalDate, ProgramType, AccommodationStatus, JourneyStatus) VALUES (@newUser, @uni, '2028-01-01', N'Erasmus', N'Confirmed', N'Planning');
  DECLARE @nj INT = SCOPE_IDENTITY();
  INSERT dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus) SELECT TOP (18) @nj, TaskID, N'Pending' FROM dbo.Task_Templates ORDER BY TaskID;
  INSERT dbo.Help_Requests (JourneyTaskID, Subject, ProblemDescription) SELECT TOP (1) JourneyTaskID, N'w', N'w' FROM dbo.Journey_Tasks WHERE JourneyID = @nj;
  ROLLBACK TRANSACTION w1;
  SET STATISTICS IO OFF;

  IF @pass = 1
  BEGIN
    CREATE INDEX IX_HelpRequests_JourneyTask ON dbo.Help_Requests (JourneyTaskID);
    CREATE INDEX IX_TaskDependencies_Required ON dbo.Task_Dependencies (RequiredTaskID);
    CREATE INDEX IX_JourneyTasks_Task ON dbo.Journey_Tasks (TaskID);
  END;
  SET @pass += 1;
END;

ROLLBACK TRANSACTION;
SELECT CONCAT('after rollback: users=', (SELECT COUNT(*) FROM dbo.Users), ' indexes0005=',
              (SELECT COUNT(*) FROM sys.indexes WHERE name IN (N'IX_HelpRequests_JourneyTask', N'IX_TaskDependencies_Required', N'IX_JourneyTasks_Task'))) AS info;
