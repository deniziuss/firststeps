/*
  MIGRATION 0004: persistent session revocation
  Approved and applied to the local FirstSteps_Dev on 2026-11-09.

  Adds dbo.Users.SessionVersion. Every session token carries the version it was issued with
  (claim "sv"); the application rejects a token whose version differs from the current row.
  The application increments the version (atomically, UPDATE ... SessionVersion + 1) on:
    - sign-out (signs out every device of that account),
    - password change (the current browser receives a new token with the new version),
    - admin role change or deactivation.
  The keyed password fingerprint ("pv") stays as a second check, for passwords changed outside
  the application. The in-memory revocation list is removed: revocation survives restarts and is
  shared by every server instance.

  Data impact: no row values change; existing rows get 0. Tokens issued before the application
  change carry no "sv" and are rejected once, so every user signs in again after deployment.
  Order: apply this script, then deploy the matching application code.
  Rollback: database/rollbacks/0004_rollback.sql (after reverting the application code).
  Idempotent: safe to run twice.
*/
IF COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD SessionVersion INT NOT NULL CONSTRAINT DF_Users_SessionVersion DEFAULT 0;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Users_SessionVersion')
BEGIN
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_SessionVersion CHECK (SessionVersion >= 0);
END;
GO
