/* Regression test for the 0006 backfill bug: on a database that was EMPTY when 0006 first ran, every
   later account is unverified. The old backfill ("if no verified account exists, verify everyone")
   would then mark all of them verified on the next run. Expected now: a re-run verifies nobody.
   The state "only unverified accounts" is created inside a transaction that is rolled back.
   CI runs it on the fresh container (where 0006 really ran on an empty Users table).
     sqlcmd ... -d FirstSteps_Test -i database/tests/0006_rerun_unverified.sql */
SET NOCOUNT ON;
IF DB_NAME() NOT IN (N'FirstSteps_Test', N'FirstSteps_RestoreTest') THROW 51000, 'Run this only against a disposable FirstSteps test database.', 1;
IF COL_LENGTH(N'dbo.Users', N'EmailVerifiedAt') IS NULL THROW 51000, 'Apply 0006 first.', 1;
BEGIN TRANSACTION;
GO
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'Rerun', N'Unverified', N'rerun+' + CONVERT(NVARCHAR(36), NEWID()) + N'@example.invalid', N'x');
EXEC sys.sp_executesql N'UPDATE dbo.Users SET EmailVerifiedAt = NULL;';
GO
:r database/migrations/0006_security_infrastructure.sql
GO
DECLARE @verified INT;
EXEC sys.sp_executesql N'SELECT @n = COUNT(*) FROM dbo.Users WHERE EmailVerifiedAt IS NOT NULL;', N'@n INT OUTPUT', @n = @verified OUTPUT;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
SELECT IIF(@verified = 0, N'PASS', N'FAIL') AS Result, CONCAT(N're-run on a database with only unverified accounts verified ', @verified, N' account(s)') AS Test;
IF @verified <> 0 THROW 51097, '0006 re-run verified unverified accounts', 1;
