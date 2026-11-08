-- Local development only. Creates FirstSteps_Dev and the application login.
-- Run with Windows authentication on the LOCAL instance:
--   sqlcmd -S localhost\SQLEXPRESS -E -b -i database/local/00_create_database.sql -v APP_PASSWORD="..."
-- scripts/db/local-setup.mjs does this and writes the generated password only to .env.local.
-- Never drops anything; safe to re-run.

IF DB_ID(N'FirstSteps_Dev') IS NULL
    CREATE DATABASE [FirstSteps_Dev];
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'firststeps_app')
    CREATE LOGIN [firststeps_app] WITH PASSWORD = N'$(APP_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = [FirstSteps_Dev];
ELSE
    ALTER LOGIN [firststeps_app] WITH PASSWORD = N'$(APP_PASSWORD)';
GO

USE [FirstSteps_Dev];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'firststeps_app')
    CREATE USER [firststeps_app] FOR LOGIN [firststeps_app];
GO
-- The app reads, writes and runs procedures. No DDL rights.
ALTER ROLE db_datareader ADD MEMBER [firststeps_app];
ALTER ROLE db_datawriter ADD MEMBER [firststeps_app];
GRANT EXECUTE ON SCHEMA::dbo TO [firststeps_app];
GO
