/* Tests proposal 0003 inside ONE transaction that is always rolled back: the trigger change and the
   synthetic rows never persist. Local FirstSteps_Dev only. Run from the repository root:
     sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d FirstSteps_Dev -i database/proposals/0003_test_rolled_back.sql
   (-b stops at the first unexpected error; the open transaction is then rolled back on disconnect.)
*/
SET NOCOUNT ON;
SET XACT_ABORT OFF;
IF DB_NAME() <> N'FirstSteps_Dev' THROW 51000, 'Run this only against FirstSteps_Dev.', 1;
BEGIN TRANSACTION;
GO
:r database/proposals/0003_prerequisite_applicability.sql
GO
DECLARE @uni INT, @otherUni INT, @user INT, @confirmed INT, @replanned INT;
INSERT dbo.Universities (UniversityName, City, Country, CountryCode) VALUES (N'Proposal Test U', N'Testcity', N'Testland', 'XX');
SET @uni = SCOPE_IDENTITY();
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'Proposal', N'Test', N'proposal-0003@example.invalid', N'not-a-hash');
SET @user = SCOPE_IDENTITY();

-- A applies only without housing; B (any) requires A. D applies to everyone; C requires D.
DECLARE @A INT, @B INT, @C INT, @D INT;
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Category, JourneyStage, AccommodationCondition) VALUES (@uni, N'P-A', N'Housing', N'BeforeArrival', N'NotArranged'); SET @A = SCOPE_IDENTITY();
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Category, JourneyStage) VALUES (@uni, N'P-B', N'Housing', N'FirstDays'); SET @B = SCOPE_IDENTITY();
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Category, JourneyStage) VALUES (@uni, N'P-C', N'University', N'FirstDays'); SET @C = SCOPE_IDENTITY();
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Category, JourneyStage) VALUES (@uni, N'P-D', N'University', N'BeforeArrival'); SET @D = SCOPE_IDENTITY();
INSERT dbo.Task_Dependencies (TaskID, RequiredTaskID) VALUES (@B, @A), (@C, @D);

-- Journey 1: housing confirmed, A was never added (genuinely not applicable).
INSERT dbo.Journeys (UserID, UniversityID, ArrivalDate, ProgramType, AccommodationStatus) VALUES (@user, @uni, '2030-01-01', N'Erasmus', N'Confirmed');
SET @confirmed = SCOPE_IDENTITY();
INSERT dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus) VALUES (@confirmed, @B, N'Pending'), (@confirmed, @C, N'Pending');
-- Journey 2: A exists but re-planning marked it NotApplicable.
INSERT dbo.Journeys (UserID, UniversityID, ArrivalDate, ProgramType, AccommodationStatus) VALUES (@user, @uni, '2030-02-01', N'Erasmus', N'Confirmed');
SET @replanned = SCOPE_IDENTITY();
INSERT dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus) VALUES (@replanned, @A, N'NotApplicable'), (@replanned, @B, N'Pending');

UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyID = @confirmed AND TaskID = @B;
IF EXISTS (SELECT 1 FROM dbo.Journey_Tasks WHERE JourneyID = @confirmed AND TaskID = @B AND TaskStatus = N'Completed' AND CompletedAt IS NOT NULL) PRINT 'PASS  not-applicable prerequisite (absent) no longer locks; CompletedAt set'; ELSE PRINT 'FAIL  not-applicable prerequisite (absent)';

UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyID = @replanned AND TaskID = @B;
IF EXISTS (SELECT 1 FROM dbo.Journey_Tasks WHERE JourneyID = @replanned AND TaskID = @B AND TaskStatus = N'Completed') PRINT 'PASS  NotApplicable prerequisite row no longer locks'; ELSE PRINT 'FAIL  NotApplicable prerequisite row';

-- Last, because a THROW inside a trigger dooms the transaction:
-- D applies to the journey but is missing (data gap) -> still blocked with 51001.
BEGIN TRY
    UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyID = @confirmed AND TaskID = @C;
    PRINT 'FAIL  applicable but missing prerequisite was accepted';
END TRY
BEGIN CATCH
    PRINT CASE WHEN ERROR_NUMBER() = 51001 THEN 'PASS  applicable but missing prerequisite still blocked (51001)' ELSE 'FAIL  unexpected error ' + CAST(ERROR_NUMBER() AS VARCHAR(10)) END;
    -- The trigger error dooms the transaction; roll back everything here.
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
END CATCH;
GO
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
GO
-- Proof that nothing persisted: the original trigger text and no test rows.
SELECT CASE WHEN OBJECT_DEFINITION(OBJECT_ID(N'dbo.trg_JourneyTasks_ValidatePrerequisites')) LIKE N'%NotApplicable%' THEN 'FAIL  proposal trigger persisted' ELSE 'PASS  original trigger still in place' END AS RollbackCheck
UNION ALL
SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Users WHERE Email = N'proposal-0003@example.invalid') THEN 'FAIL  test rows persisted' ELSE 'PASS  no test rows left' END;
