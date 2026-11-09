/* ROLLBACK 0004: removes dbo.Users.SessionVersion. Revert the application code first.
   Data impact: only the session version counters are lost; all current sessions remain signed
   by the application secret and are validated by the password fingerprint again. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Users_SessionVersion')
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_SessionVersion;
GO
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_Users_SessionVersion')
    ALTER TABLE dbo.Users DROP CONSTRAINT DF_Users_SessionVersion;
GO
IF COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NOT NULL
    ALTER TABLE dbo.Users DROP COLUMN SessionVersion;
GO
