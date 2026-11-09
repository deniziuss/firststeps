/* Rehearses the rollbacks of migrations 0003 and 0004 and their re-application inside ONE transaction
   that is always rolled back, so FirstSteps_Dev keeps its current schema. SQL Server DDL is transactional.
     sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d FirstSteps_Dev -i database/rollbacks/rehearse_rollback.sql
*/
SET NOCOUNT ON;
IF DB_NAME() <> N'FirstSteps_Dev' THROW 51000, 'Run this only against FirstSteps_Dev.', 1;
BEGIN TRANSACTION;
GO
:r database/rollbacks/0004_rollback.sql
:r database/rollbacks/0003_rollback.sql
SELECT 'after rollback' AS Step,
       IIF(COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NULL, 'PASS column removed', 'FAIL column still there') AS SessionVersion,
       IIF(OBJECT_DEFINITION(OBJECT_ID(N'dbo.trg_JourneyTasks_ValidatePrerequisites')) NOT LIKE N'%AccommodationCondition%', 'PASS original trigger', 'FAIL 0003 trigger still active') AS PrerequisiteTrigger,
       (SELECT COUNT(*) FROM dbo.Users) AS UsersKept;
GO
:r database/migrations/0003_prerequisite_applicability.sql
:r database/migrations/0004_session_version.sql
SELECT 'after re-apply' AS Step,
       IIF(COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NOT NULL, 'PASS column back', 'FAIL column missing') AS SessionVersion,
       IIF(OBJECT_DEFINITION(OBJECT_ID(N'dbo.trg_JourneyTasks_ValidatePrerequisites')) LIKE N'%AccommodationCondition%', 'PASS 0003 trigger', 'FAIL original trigger') AS PrerequisiteTrigger,
       (SELECT COUNT(*) FROM dbo.Users) AS UsersKept;
GO
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
GO
SELECT 'after ROLLBACK (current state)' AS Step,
       IIF(COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NOT NULL, 'PASS migration 0004 still applied', 'FAIL') AS SessionVersion,
       IIF(OBJECT_DEFINITION(OBJECT_ID(N'dbo.trg_JourneyTasks_ValidatePrerequisites')) LIKE N'%AccommodationCondition%', 'PASS migration 0003 still applied', 'FAIL') AS PrerequisiteTrigger;
