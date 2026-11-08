-- Local development only: object counts + behaviour tests on FirstSteps_Dev.
-- Each test runs in its own transaction and is rolled back; rows are synthetic. IDENTITY values may advance.
-- A THROW inside a trigger dooms the whole transaction (error 3930 on further writes), so negative tests
-- capture the error, roll back, and only then record the result.
USE [FirstSteps_Dev];
GO
IF DB_NAME() <> N'FirstSteps_Dev' THROW 51000, 'Wrong database selected.', 1;
GO
SET NOCOUNT ON;

SELECT
  (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0 AND name <> N'sysdiagrams' AND name NOT LIKE N'%[_]Translations') AS CourseTables,
  (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'%[_]Translations') AS TranslationTables,
  (SELECT COUNT(*) FROM sys.key_constraints k JOIN sys.tables t ON t.object_id = k.parent_object_id
    WHERE k.type = 'PK' AND t.is_ms_shipped = 0 AND t.name <> N'sysdiagrams' AND t.name NOT LIKE N'%[_]Translations') AS PrimaryKeys,
  (SELECT COUNT(*) FROM sys.foreign_keys WHERE is_ms_shipped = 0 AND OBJECT_NAME(parent_object_id) NOT LIKE N'%[_]Translations') AS ForeignKeys,
  (SELECT COUNT(*) FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
    WHERE t.is_ms_shipped = 0 AND i.name LIKE N'IX[_]%') AS Indexes,
  (SELECT COUNT(*) FROM sys.triggers WHERE parent_class = 1 AND is_ms_shipped = 0) AS Triggers,
  (SELECT COUNT(*) FROM sys.procedures WHERE is_ms_shipped = 0) AS Procedures;
GO

-- Fixture: a synthetic student with an Erasmus journey. Temporary procedure, gone when the session ends.
CREATE PROCEDURE #CreateFixture @StudentID INT OUTPUT, @JourneyID INT OUTPUT, @Prereq INT OUTPUT, @Dependent INT OUTPUT
AS
BEGIN
    DECLARE @Email NVARCHAR(255) = N'verify+' + CONVERT(NVARCHAR(36), NEWID()) + N'@example.invalid';
    DECLARE @Uni INT = (SELECT TOP (1) UniversityID FROM dbo.Universities ORDER BY UniversityID);
    EXEC dbo.usp_User_Insert @FirstName = N'Verify', @LastName = N'Student', @Email = @Email,
         @PasswordHash = N'synthetic-not-a-login-hash', @NewUserID = @StudentID OUTPUT;
    EXEC dbo.usp_Journey_CreateWithTasks @UserID = @StudentID, @UniversityID = @Uni, @ArrivalDate = '2027-02-01',
         @ProgramType = N'Erasmus', @AccommodationStatus = N'NotArranged', @NewJourneyID = @JourneyID OUTPUT;
    -- A dependency whose prerequisite has no prerequisites of its own.
    SELECT TOP (1) @Dependent = dep.JourneyTaskID, @Prereq = pre.JourneyTaskID
      FROM dbo.Task_Dependencies d
      JOIN dbo.Journey_Tasks dep ON dep.TaskID = d.TaskID AND dep.JourneyID = @JourneyID
      JOIN dbo.Journey_Tasks pre ON pre.TaskID = d.RequiredTaskID AND pre.JourneyID = @JourneyID
     WHERE NOT EXISTS (SELECT 1 FROM dbo.Task_Dependencies d2 WHERE d2.TaskID = d.RequiredTaskID)
     ORDER BY d.TaskID;
END;
GO

SET NOCOUNT ON;
DECLARE @Results TABLE (Test NVARCHAR(100), Result NVARCHAR(10), Detail NVARCHAR(400));
DECLARE @StudentID INT, @JourneyID INT, @Prereq INT, @Dependent INT, @HelpID INT, @Err INT, @Msg NVARCHAR(400);

-- 1. Positive path: insert, transaction, triggers, update/delete/cursor procedures.
BEGIN TRANSACTION;
BEGIN TRY
    EXEC #CreateFixture @StudentID OUTPUT, @JourneyID OUTPUT, @Prereq OUTPUT, @Dependent OUTPUT;
    INSERT INTO @Results VALUES (N'Insert procedure + SCOPE_IDENTITY', IIF(@StudentID IS NOT NULL, N'PASS', N'FAIL'),
        CONCAT(N'NewUserID=', @StudentID, N', @@IDENTITY after journey insert=', @@IDENTITY));
    INSERT INTO @Results SELECT N'Transaction procedure creates tasks', IIF(COUNT(*) > 0, N'PASS', N'FAIL'), CONCAT(COUNT(*), N' tasks')
      FROM dbo.Journey_Tasks WHERE JourneyID = @JourneyID;

    UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyTaskID = @Prereq;
    INSERT INTO @Results SELECT N'Trigger sets CompletedAt', IIF(CompletedAt IS NOT NULL, N'PASS', N'FAIL'), CONVERT(NVARCHAR(30), CompletedAt, 126)
      FROM dbo.Journey_Tasks WHERE JourneyTaskID = @Prereq;

    UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyTaskID = @Dependent;
    INSERT INTO @Results SELECT N'Dependent completes after prerequisite', IIF(TaskStatus = N'Completed', N'PASS', N'FAIL'), TaskStatus
      FROM dbo.Journey_Tasks WHERE JourneyTaskID = @Dependent;

    DECLARE @Ignore TABLE (JourneyTaskID INT, JourneyID INT, TaskID INT, TaskStatus NVARCHAR(20), CompletedAt DATETIME2(0));
    INSERT INTO @Ignore EXEC dbo.usp_JourneyTask_UpdateStatus @JourneyTaskID = @Dependent, @NewStatus = N'Pending';
    INSERT INTO @Results SELECT N'Update procedure: Completed -> Pending clears CompletedAt',
        IIF(TaskStatus = N'Pending' AND CompletedAt IS NULL, N'PASS', N'FAIL'), TaskStatus
      FROM dbo.Journey_Tasks WHERE JourneyTaskID = @Dependent;

    INSERT INTO dbo.Help_Requests (JourneyTaskID, Subject, ProblemDescription) VALUES (@Prereq, N'Synthetic request', N'Synthetic verification data.');
    SET @HelpID = CONVERT(INT, SCOPE_IDENTITY());
    EXEC dbo.usp_HelpRequest_DeleteOpen @RequestID = @HelpID;
    INSERT INTO @Results VALUES (N'Delete procedure removes open request',
        IIF(NOT EXISTS (SELECT 1 FROM dbo.Help_Requests WHERE RequestID = @HelpID), N'PASS', N'FAIL'), NULL);

    DECLARE @Report TABLE (TaskNumber INT, TaskTitle NVARCHAR(200), TaskStatus NVARCHAR(20));
    INSERT INTO @Report EXEC dbo.usp_Journey_PendingTaskCursorReport @JourneyID = @JourneyID;
    INSERT INTO @Results SELECT N'Cursor procedure report', IIF(COUNT(*) > 0, N'PASS', N'FAIL'), CONCAT(COUNT(*), N' open tasks') FROM @Report;
END TRY
BEGIN CATCH
    SELECT @Err = ERROR_NUMBER(), @Msg = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    INSERT INTO @Results VALUES (N'Positive path', N'FAIL', CONCAT(@Err, N': ', @Msg));
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

-- 2. Trigger 51001: a dependent task cannot be completed before its prerequisite.
SELECT @Err = NULL, @Msg = NULL;
BEGIN TRANSACTION;
BEGIN TRY
    EXEC #CreateFixture @StudentID OUTPUT, @JourneyID OUTPUT, @Prereq OUTPUT, @Dependent OUTPUT;
    UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyTaskID = @Dependent;
END TRY
BEGIN CATCH
    SELECT @Err = ERROR_NUMBER(), @Msg = ERROR_MESSAGE();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
INSERT INTO @Results VALUES (N'Trigger 51001 blocks unmet prerequisite', IIF(@Err = 51001, N'PASS', N'FAIL'), COALESCE(@Msg, N'Update was allowed'));

-- 3. Trigger 51002: a student cannot be assigned as mentor.
SELECT @Err = NULL, @Msg = NULL;
BEGIN TRANSACTION;
BEGIN TRY
    EXEC #CreateFixture @StudentID OUTPUT, @JourneyID OUTPUT, @Prereq OUTPUT, @Dependent OUTPUT;
    INSERT INTO dbo.Help_Requests (JourneyTaskID, MentorUserID, Subject, ProblemDescription, RequestStatus)
    VALUES (@Prereq, @StudentID, N'Synthetic request', N'Synthetic verification data.', N'Assigned');
END TRY
BEGIN CATCH
    SELECT @Err = ERROR_NUMBER(), @Msg = ERROR_MESSAGE();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
INSERT INTO @Results VALUES (N'Trigger 51002 blocks Student as mentor', IIF(@Err = 51002, N'PASS', N'FAIL'), COALESCE(@Msg, N'Insert was allowed'));

-- 4. UNIQUE(JourneyID, TaskID): the same task cannot be added twice to a journey.
SELECT @Err = NULL, @Msg = NULL;
BEGIN TRANSACTION;
BEGIN TRY
    EXEC #CreateFixture @StudentID OUTPUT, @JourneyID OUTPUT, @Prereq OUTPUT, @Dependent OUTPUT;
    INSERT INTO dbo.Journey_Tasks (JourneyID, TaskID) SELECT JourneyID, TaskID FROM dbo.Journey_Tasks WHERE JourneyTaskID = @Prereq;
END TRY
BEGIN CATCH
    SELECT @Err = ERROR_NUMBER(), @Msg = ERROR_MESSAGE();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
INSERT INTO @Results VALUES (N'UNIQUE blocks duplicate journey task', IIF(@Err IN (2627, 2601), N'PASS', N'FAIL'), COALESCE(LEFT(@Msg, 120), N'Insert was allowed'));

SELECT Test, Result, Detail FROM @Results;
SELECT IIF(EXISTS (SELECT 1 FROM dbo.Users WHERE Email LIKE N'verify+%@example.invalid'), N'FAIL: rows left behind', N'Rolled back') AS Cleanup;
GO
