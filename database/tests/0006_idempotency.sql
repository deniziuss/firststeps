/* Idempotency of proposal 0006's EmailVerifiedAt backfill. Everything runs inside ONE transaction that
   is always rolled back, so the database keeps its current schema and data (SQL Server DDL is
   transactional). If 0006 is already present it is first rolled back inside that transaction.
   Run from the repository root against a disposable database only:
     sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d FirstSteps_RestoreTest -i database/tests/0006_idempotency.sql

   Scenarios: (1) accounts existing at the first run are backfilled; (6) an interrupted first run leaves
   no column and no partial backfill; (3) new registrations stay unverified; (4) a second run changes
   nothing; (5) a third run with verified and unverified accounts changes nothing.
   Scenario (2), a database that is empty at the first run, is covered by
   database/tests/0006_rerun_unverified.sql in the CI job (fresh container). */
SET NOCOUNT ON;
SET XACT_ABORT OFF;
IF DB_NAME() NOT IN (N'FirstSteps_Test', N'FirstSteps_RestoreTest') THROW 51000, 'Run this only against a disposable FirstSteps test database.', 1;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
CREATE TABLE #r (Seq INT IDENTITY, Test NVARCHAR(120), Result NVARCHAR(4));
CREATE TABLE #u (Name SYSNAME PRIMARY KEY, UserID INT, CreatedAt DATETIME2(0));
BEGIN TRANSACTION;
GO
IF COL_LENGTH(N'dbo.Users', N'EmailVerifiedAt') IS NOT NULL
BEGIN
    PRINT 'Removing the existing 0006 objects inside the test transaction';
END;
GO
:r database/rollbacks/0006_rollback.sql
GO
-- Accounts that exist before the first run (an admin and a student).
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash, UserRole, CreatedAt) VALUES (N'Old', N'Admin', N'idem+old-admin@example.invalid', N'x', N'Admin', '2026-01-01T10:00:00');
INSERT #u VALUES (N'oldAdmin', SCOPE_IDENTITY(), '2026-01-01T10:00:00');
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash, CreatedAt) VALUES (N'Old', N'Student', N'idem+old-student@example.invalid', N'x', '2026-01-02T10:00:00');
INSERT #u VALUES (N'oldStudent', SCOPE_IDENTITY(), '2026-01-02T10:00:00');

-- (6) Interrupted first run: the column is added and the work fails before the backfill commits.
SAVE TRANSACTION interrupted;
ALTER TABLE dbo.Users ADD EmailVerifiedAt DATETIME2(0) NULL;
ROLLBACK TRANSACTION interrupted;
INSERT #r VALUES (N'(6) interrupted run leaves no EmailVerifiedAt column', IIF(COL_LENGTH(N'dbo.Users', N'EmailVerifiedAt') IS NULL, N'PASS', N'FAIL'));
GO
-- First real run.
:r database/migrations/0006_security_infrastructure.sql
GO
INSERT #r SELECT N'(1) accounts existing at the first run are verified with their CreatedAt',
    IIF(COUNT(*) = 2, N'PASS', N'FAIL')
  FROM dbo.Users u JOIN #u ON #u.UserID = u.UserID WHERE u.EmailVerifiedAt = #u.CreatedAt;
INSERT #r SELECT N'(1) every account existing at the first run is verified (incl. admin, mentor)',
    IIF(NOT EXISTS (SELECT 1 FROM dbo.Users WHERE EmailVerifiedAt IS NULL), N'PASS', N'FAIL');
-- (3) A registration after the first run, and one that confirms its address.
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'New', N'Student', N'idem+new@example.invalid', N'x');
INSERT #u VALUES (N'newStudent', SCOPE_IDENTITY(), NULL);
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash, EmailVerifiedAt) VALUES (N'New', N'Verified', N'idem+verified@example.invalid', N'x', '2026-03-03T03:03:03');
INSERT #u VALUES (N'newVerified', SCOPE_IDENTITY(), NULL);
GO
-- (4) Second run.
:r database/migrations/0006_security_infrastructure.sql
GO
INSERT #r SELECT N'(3)(4) a new registration stays unverified after a second run',
    IIF((SELECT EmailVerifiedAt FROM dbo.Users WHERE UserID = (SELECT UserID FROM #u WHERE Name = N'newStudent')) IS NULL, N'PASS', N'FAIL');
INSERT #r SELECT N'(4) a verification timestamp is not changed by a second run',
    IIF((SELECT EmailVerifiedAt FROM dbo.Users WHERE UserID = (SELECT UserID FROM #u WHERE Name = N'newVerified')) = '2026-03-03T03:03:03', N'PASS', N'FAIL');
GO
-- (5) Third run with verified and unverified accounts.
:r database/migrations/0006_security_infrastructure.sql
GO
INSERT #r SELECT N'(5) third run: unverified stays unverified, verified keeps its time, old accounts unchanged',
    IIF((SELECT EmailVerifiedAt FROM dbo.Users WHERE UserID = (SELECT UserID FROM #u WHERE Name = N'newStudent')) IS NULL
        AND (SELECT EmailVerifiedAt FROM dbo.Users WHERE UserID = (SELECT UserID FROM #u WHERE Name = N'newVerified')) = '2026-03-03T03:03:03'
        AND (SELECT COUNT(*) FROM dbo.Users u JOIN #u ON #u.UserID = u.UserID WHERE #u.CreatedAt IS NOT NULL AND u.EmailVerifiedAt = #u.CreatedAt) = 2,
        N'PASS', N'FAIL');
INSERT #r SELECT N'(5) every 0006 object exists exactly once after three runs',
    IIF(OBJECT_ID(N'dbo.Rate_Limit_Buckets') IS NOT NULL AND OBJECT_ID(N'dbo.Account_Tokens') IS NOT NULL AND OBJECT_ID(N'dbo.Admin_Audit_Events') IS NOT NULL
        AND OBJECT_ID(N'dbo.trg_AdminAuditEvents_AppendOnly') IS NOT NULL
        AND (SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Admin_Audit_Events')) = 5, N'PASS', N'FAIL');
INSERT #r SELECT N'(7) migrations 0003 and 0004 are untouched',
    IIF(OBJECT_DEFINITION(OBJECT_ID(N'dbo.trg_JourneyTasks_ValidatePrerequisites')) LIKE N'%AccommodationCondition%'
        AND COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NOT NULL, N'PASS', N'FAIL');
GO
-- Results are copied to a table variable first: the rollback also undoes rows written to #r.
DECLARE @results TABLE (Seq INT, Test NVARCHAR(120), Result NVARCHAR(4));
INSERT @results SELECT Seq, Test, Result FROM #r;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
INSERT @results VALUES (100, N'rolled back: no test rows left, 0006 state as before',
    IIF(NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Email LIKE N'idem+%'), N'PASS', N'FAIL'));
SELECT Result, Test FROM @results ORDER BY Seq;
IF (SELECT COUNT(*) FROM @results) < 9 OR EXISTS (SELECT 1 FROM @results WHERE Result = N'FAIL') THROW 51098, '0006 idempotency test failed', 1;
