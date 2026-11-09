/*
  MIGRATION 0006: security infrastructure (application tables; the eight course tables are unchanged
  except for one new nullable column on dbo.Users).

  1. dbo.Rate_Limit_Buckets   persistent, atomic rate-limit counters (survive restarts, shared by
                              every app instance). Keys are SHA-256 hashes: no email or IP is stored.
  2. dbo.Users.EmailVerifiedAt when the owner proved control of the email address (NULL = unverified).
                              Existing accounts are backfilled as verified (they predate verification).
  3. dbo.Account_Tokens       single-use email-verification and password-reset tokens. Only the
                              SHA-256 hash of a token is stored; the raw token exists only in the email.
  4. dbo.Admin_Audit_Events   append-only audit history of administrative changes. UPDATE is always
                              refused; DELETE only through dbo.usp_AdminAudit_Purge (retention).

  Idempotent. Rollback: database/rollbacks/0006_rollback.sql.
  Status: approved and applied to the local FirstSteps_Dev on 2026-11-10 (after a verified backup); 4 existing
  accounts backfilled as verified. Tested before on FirstSteps_Test and FirstSteps_RestoreTest and in CI.
*/
SET NOCOUNT ON;
GO

/* 1. Rate limits ------------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.Rate_Limit_Buckets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Rate_Limit_Buckets (
        BucketKey CHAR(64) NOT NULL CONSTRAINT PK_RateLimitBuckets PRIMARY KEY,
        Scope VARCHAR(30) NOT NULL,
        Hits INT NOT NULL CONSTRAINT CK_RateLimitBuckets_Hits CHECK (Hits >= 0),
        WindowEndsAt DATETIME2(0) NOT NULL
    );
    CREATE INDEX IX_RateLimitBuckets_WindowEnds ON dbo.Rate_Limit_Buckets (WindowEndsAt);
END;
GO

-- Counts one event in a fixed window and returns the count in the current window. The UPDLOCK +
-- HOLDLOCK (serializable) lock on the key makes concurrent calls for the same key queue up, so two
-- requests can neither lose an increment nor both insert the first row.
CREATE OR ALTER PROCEDURE dbo.usp_RateLimit_Hit
    @BucketKey CHAR(64),
    @Scope VARCHAR(30),
    @WindowSeconds INT,
    @Hits INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @now DATETIME2(0) = SYSUTCDATETIME();
    BEGIN TRANSACTION;
        UPDATE dbo.Rate_Limit_Buckets WITH (UPDLOCK, HOLDLOCK)
           SET Hits = CASE WHEN WindowEndsAt <= @now THEN 1 ELSE Hits + 1 END,
               WindowEndsAt = CASE WHEN WindowEndsAt <= @now THEN DATEADD(SECOND, @WindowSeconds, @now) ELSE WindowEndsAt END,
               @Hits = CASE WHEN WindowEndsAt <= @now THEN 1 ELSE Hits + 1 END
         WHERE BucketKey = @BucketKey;
        IF @@ROWCOUNT = 0
        BEGIN
            INSERT INTO dbo.Rate_Limit_Buckets (BucketKey, Scope, Hits, WindowEndsAt)
            VALUES (@BucketKey, @Scope, 1, DATEADD(SECOND, @WindowSeconds, @now));
            SET @Hits = 1;
        END;
    COMMIT TRANSACTION;
END;
GO

-- Current count without counting (0 when the window has ended).
CREATE OR ALTER PROCEDURE dbo.usp_RateLimit_Peek
    @BucketKey CHAR(64),
    @Hits INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT @Hits = COALESCE(MAX(Hits), 0)
      FROM dbo.Rate_Limit_Buckets
     WHERE BucketKey = @BucketKey AND WindowEndsAt > SYSUTCDATETIME();
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_RateLimit_Reset
    @BucketKey CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.Rate_Limit_Buckets WHERE BucketKey = @BucketKey;
END;
GO

-- Removes expired windows in small batches (bounded storage). Returns the number of rows deleted.
CREATE OR ALTER PROCEDURE dbo.usp_RateLimit_Purge
    @MaxRows INT = 500
AS
BEGIN
    SET NOCOUNT ON;
    DELETE TOP (@MaxRows) FROM dbo.Rate_Limit_Buckets WHERE WindowEndsAt < SYSUTCDATETIME();
    SELECT @@ROWCOUNT AS Deleted;
END;
GO

/* 2. Email verification state ------------------------------------------------------------------ */
-- The column is added and the accounts that exist AT THAT MOMENT are backfilled as verified, in one
-- transaction, in the same batch that adds the column:
--   - the backfill runs only in the execution that creates the column, so later executions (also on a
--     database that started empty) never mark newly registered, unverified accounts as verified;
--   - existing timestamps are never overwritten (only NULL values in that one-time backfill);
--   - an interrupted run leaves neither the column nor a partial backfill (XACT_ABORT rolls back
--     both), so the next run starts cleanly;
--   - the UPDATE is dynamic SQL, compiled only after the column exists (a static reference would
--     fail to compile when the batch is parsed before the column is added).
-- Backfilled rows are recognisable by EmailVerifiedAt = CreatedAt.
SET XACT_ABORT ON;
IF COL_LENGTH(N'dbo.Users', N'EmailVerifiedAt') IS NULL
BEGIN
    BEGIN TRANSACTION;
        ALTER TABLE dbo.Users ADD EmailVerifiedAt DATETIME2(0) NULL;
        EXEC sys.sp_executesql N'UPDATE dbo.Users SET EmailVerifiedAt = CreatedAt WHERE EmailVerifiedAt IS NULL;';
    COMMIT TRANSACTION;
END;
SET XACT_ABORT OFF;
GO

/* 3. Account tokens ---------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Account_Tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Account_Tokens (
        TokenID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccountTokens PRIMARY KEY,
        UserID INT NOT NULL CONSTRAINT FK_AccountTokens_User REFERENCES dbo.Users (UserID) ON DELETE CASCADE,
        Purpose VARCHAR(20) NOT NULL CONSTRAINT CK_AccountTokens_Purpose CHECK (Purpose IN ('VerifyEmail', 'ResetPassword')),
        TokenHash BINARY(32) NOT NULL CONSTRAINT UQ_AccountTokens_Hash UNIQUE,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AccountTokens_Created DEFAULT SYSUTCDATETIME(),
        ExpiresAt DATETIME2(0) NOT NULL,
        UsedAt DATETIME2(0) NULL,
        CONSTRAINT CK_AccountTokens_Expiry CHECK (ExpiresAt > CreatedAt),
        CONSTRAINT CK_AccountTokens_Used CHECK (UsedAt IS NULL OR UsedAt >= CreatedAt)
    );
    CREATE INDEX IX_AccountTokens_UserPurpose ON dbo.Account_Tokens (UserID, Purpose) INCLUDE (UsedAt, ExpiresAt);
END;
GO

/* 4. Admin audit events ------------------------------------------------------------------------ */
IF OBJECT_ID(N'dbo.Admin_Audit_Events', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Admin_Audit_Events (
        EventID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdminAuditEvents PRIMARY KEY,
        EventUid UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_AdminAuditEvents_Uid DEFAULT NEWID(),
        AdminUserID INT NOT NULL CONSTRAINT FK_AdminAuditEvents_Admin REFERENCES dbo.Users (UserID),
        Action VARCHAR(40) NOT NULL,
        EntityType VARCHAR(30) NOT NULL,
        EntityID INT NULL,
        Outcome VARCHAR(10) NOT NULL CONSTRAINT DF_AdminAuditEvents_Outcome DEFAULT 'Success'
            CONSTRAINT CK_AdminAuditEvents_Outcome CHECK (Outcome IN ('Success')),
        Details NVARCHAR(1000) NULL,
        CreatedAt DATETIME2(3) NOT NULL CONSTRAINT DF_AdminAuditEvents_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_AdminAuditEvents_Uid UNIQUE (EventUid)
    );
    CREATE INDEX IX_AdminAuditEvents_Created ON dbo.Admin_Audit_Events (CreatedAt DESC);
    CREATE INDEX IX_AdminAuditEvents_Entity ON dbo.Admin_Audit_Events (EntityType, EntityID);
    CREATE INDEX IX_AdminAuditEvents_Action ON dbo.Admin_Audit_Events (Action, CreatedAt DESC);
END;
GO

-- Append-only: updates are refused, deletes only by the retention procedure.
CREATE OR ALTER TRIGGER dbo.trg_AdminAuditEvents_AppendOnly
ON dbo.Admin_Audit_Events
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM inserted)
        THROW 51020, 'Audit events cannot be changed.', 1;
    IF CAST(SESSION_CONTEXT(N'fs_audit_retention') AS INT) IS NULL OR CAST(SESSION_CONTEXT(N'fs_audit_retention') AS INT) <> 1
        THROW 51021, 'Audit events can only be removed by the retention procedure.', 1;
    IF EXISTS (SELECT 1 FROM deleted WHERE CreatedAt > DATEADD(DAY, -365, SYSUTCDATETIME()))
        THROW 51022, 'Audit events younger than 365 days are kept.', 1;
    DELETE e FROM dbo.Admin_Audit_Events e JOIN deleted d ON d.EventID = e.EventID;
END;
GO

-- Retention: removes events older than @KeepDays (at least 365). A maintenance operation, not
-- exposed in the application.
CREATE OR ALTER PROCEDURE dbo.usp_AdminAudit_Purge
    @KeepDays INT = 730
AS
BEGIN
    SET NOCOUNT ON;
    IF @KeepDays < 365 THROW 51023, 'Audit events are kept for at least 365 days.', 1;
    EXEC sys.sp_set_session_context @key = N'fs_audit_retention', @value = 1;
    DELETE FROM dbo.Admin_Audit_Events WHERE CreatedAt < DATEADD(DAY, -@KeepDays, SYSUTCDATETIME());
    DECLARE @deleted INT = @@ROWCOUNT;
    EXEC sys.sp_set_session_context @key = N'fs_audit_retention', @value = NULL;
    SELECT @deleted AS Deleted;
END;
GO
