/* Behaviour checks for proposal/migration 0006 (security infrastructure). Every change happens inside
   transactions that are rolled back. Run against FirstSteps_Test (local disposable copy or CI):
     sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d FirstSteps_Test -i database/tests/0006_verify.sql
   Prints one PASS/FAIL line per check; the CI job fails on any FAIL. */
SET NOCOUNT ON;
SET XACT_ABORT OFF;
IF DB_NAME() NOT IN (N'FirstSteps_Dev', N'FirstSteps_Test') THROW 51000, 'Wrong database selected.', 1;
DECLARE @r TABLE (Test NVARCHAR(100), Result NVARCHAR(4));
DECLARE @h INT, @k CHAR(64) = REPLICATE('f', 64), @err INT;

BEGIN TRANSACTION;
EXEC dbo.usp_RateLimit_Hit @k, 'verify', 60, @h OUTPUT;
EXEC dbo.usp_RateLimit_Hit @k, 'verify', 60, @h OUTPUT;
EXEC dbo.usp_RateLimit_Hit @k, 'verify', 60, @h OUTPUT;
INSERT @r VALUES (N'Rate limit counts within the window', IIF(@h = 3, N'PASS', N'FAIL'));
EXEC dbo.usp_RateLimit_Peek @k, @h OUTPUT;
INSERT @r VALUES (N'Rate limit peek does not count', IIF(@h = 3, N'PASS', N'FAIL'));
UPDATE dbo.Rate_Limit_Buckets SET WindowEndsAt = DATEADD(SECOND, -1, SYSUTCDATETIME()) WHERE BucketKey = @k;
EXEC dbo.usp_RateLimit_Hit @k, 'verify', 60, @h OUTPUT;
INSERT @r VALUES (N'Rate limit window restarts after expiry', IIF(@h = 1, N'PASS', N'FAIL'));
UPDATE dbo.Rate_Limit_Buckets SET WindowEndsAt = DATEADD(SECOND, -1, SYSUTCDATETIME()) WHERE BucketKey = @k;
EXEC dbo.usp_RateLimit_Purge 500;
INSERT @r VALUES (N'Rate limit purge removes expired rows', IIF(NOT EXISTS (SELECT 1 FROM dbo.Rate_Limit_Buckets WHERE BucketKey = @k), N'PASS', N'FAIL'));
ROLLBACK TRANSACTION;

BEGIN TRANSACTION;
DECLARE @user INT;
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'Verify', N'Tokens', N'verify+0006-' + CONVERT(NVARCHAR(36), NEWID()) + N'@example.invalid', N'x');
SET @user = SCOPE_IDENTITY();
INSERT @r VALUES (N'New accounts start unverified', IIF((SELECT EmailVerifiedAt FROM dbo.Users WHERE UserID = @user) IS NULL, N'PASS', N'FAIL'));
INSERT dbo.Account_Tokens (UserID, Purpose, TokenHash, ExpiresAt) VALUES (@user, 'ResetPassword', HASHBYTES('SHA2_256', 'a'), DATEADD(MINUTE, 30, SYSUTCDATETIME()));
UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME() WHERE TokenHash = HASHBYTES('SHA2_256', 'a') AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME();
DECLARE @second INT;
UPDATE dbo.Account_Tokens SET UsedAt = SYSUTCDATETIME() WHERE TokenHash = HASHBYTES('SHA2_256', 'a') AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME();
SET @second = @@ROWCOUNT;
INSERT @r VALUES (N'A token can be consumed only once', IIF(@second = 0, N'PASS', N'FAIL'));
BEGIN TRY
    INSERT dbo.Account_Tokens (UserID, Purpose, TokenHash, ExpiresAt) VALUES (@user, 'Other', HASHBYTES('SHA2_256', 'b'), DATEADD(MINUTE, 30, SYSUTCDATETIME()));
    INSERT @r VALUES (N'Token purpose is constrained', N'FAIL');
END TRY
BEGIN CATCH
    INSERT @r VALUES (N'Token purpose is constrained', IIF(ERROR_NUMBER() = 547, N'PASS', N'FAIL'));
END CATCH;
DELETE FROM dbo.Users WHERE UserID = @user;
INSERT @r VALUES (N'Tokens are removed with their user', IIF(NOT EXISTS (SELECT 1 FROM dbo.Account_Tokens WHERE UserID = @user), N'PASS', N'FAIL'));
ROLLBACK TRANSACTION;

-- Append-only audit log. Each refused change is tested in its own transaction (a trigger THROW
-- dooms the transaction).
-- Each block creates its own admin inside the transaction, so the checks also work on an empty database (CI).
DECLARE @admin INT;
SET @err = NULL;
BEGIN TRANSACTION;
BEGIN TRY
    INSERT dbo.Users (FirstName, LastName, Email, PasswordHash, UserRole) VALUES (N'Verify', N'Admin', N'verify+0006-admin-' + CONVERT(NVARCHAR(36), NEWID()) + N'@example.invalid', N'x', N'Admin');
    SET @admin = SCOPE_IDENTITY();
    INSERT dbo.Admin_Audit_Events (AdminUserID, Action, EntityType, EntityID) VALUES (@admin, 'verify', 'Test', 1);
    UPDATE dbo.Admin_Audit_Events SET Action = 'changed' WHERE Action = 'verify';
END TRY
BEGIN CATCH
    SET @err = ERROR_NUMBER();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
INSERT @r VALUES (N'Audit events cannot be updated', IIF(@err = 51020, N'PASS', N'FAIL'));

SET @err = NULL;
BEGIN TRANSACTION;
BEGIN TRY
    INSERT dbo.Users (FirstName, LastName, Email, PasswordHash, UserRole) VALUES (N'Verify', N'Admin', N'verify+0006-admin-' + CONVERT(NVARCHAR(36), NEWID()) + N'@example.invalid', N'x', N'Admin');
    SET @admin = SCOPE_IDENTITY();
    INSERT dbo.Admin_Audit_Events (AdminUserID, Action, EntityType, EntityID) VALUES (@admin, 'verify', 'Test', 1);
    DELETE FROM dbo.Admin_Audit_Events WHERE Action = 'verify';
END TRY
BEGIN CATCH
    SET @err = ERROR_NUMBER();
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
INSERT @r VALUES (N'Audit events cannot be deleted outside retention', IIF(@err = 51021, N'PASS', N'FAIL'));

SET @err = NULL;
BEGIN TRY
    EXEC dbo.usp_AdminAudit_Purge @KeepDays = 30;
END TRY
BEGIN CATCH
    SET @err = ERROR_NUMBER();
END CATCH;
INSERT @r VALUES (N'Audit retention keeps at least 365 days', IIF(@err = 51023, N'PASS', N'FAIL'));

SELECT Result, Test FROM @r;
IF EXISTS (SELECT 1 FROM @r WHERE Result = N'FAIL') THROW 51099, '0006 verification failed', 1;
