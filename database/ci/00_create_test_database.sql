-- CI only: creates the disposable FirstSteps_Test database and the least-privilege app login inside the
-- throw-away SQL Server container of the GitHub Actions job. Never run against a real server.
--   sqlcmd ... -i database/ci/00_create_test_database.sql -v APP_PASSWORD="..."
IF DB_ID(N'FirstSteps_Test') IS NULL
    CREATE DATABASE [FirstSteps_Test];
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'firststeps_app')
    CREATE LOGIN [firststeps_app] WITH PASSWORD = N'$(APP_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = [FirstSteps_Test];
GO
USE [FirstSteps_Test];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'firststeps_app')
    CREATE USER [firststeps_app] FOR LOGIN [firststeps_app];
GO
ALTER ROLE db_datareader ADD MEMBER [firststeps_app];
ALTER ROLE db_datawriter ADD MEMBER [firststeps_app];
GRANT EXECUTE ON SCHEMA::dbo TO [firststeps_app];
GO
