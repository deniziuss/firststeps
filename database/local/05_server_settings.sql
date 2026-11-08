-- Local development only: instance settings for SQL Server Express (run as a sysadmin, e.g.
--   sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -i database/local/05_server_settings.sql).
-- When the machine is short of memory, Express shrinks its query memory pool. Below ~20 MB, the
-- app's sorted list queries cannot get their memory grant and wait until they time out
-- (RESOURCE_SEMAPHORE waits, pages stalling for 15+ seconds). A floor of 512 MB prevents that.
-- The floor is not allocated up front; SQL Server keeps it only after it has used that much.
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'min server memory (MB)', 512;
RECONFIGURE;
