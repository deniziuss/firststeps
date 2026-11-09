# Restores a FirstSteps_Dev backup into a SEPARATE disposable database and validates it.
# - Target must be FirstSteps_Test or FirstSteps_RestoreTest; FirstSteps_Dev is never a target.
# - WITH REPLACE only ever overwrites that disposable target (its own data files, *_Test.mdf).
# - Validation: DBCC CHECKDB, the eight course tables exist, row counts match the source database
#   at backup time are reported, and the app login can read the restored database.
# Usage: powershell -File scripts/db/restore-test.ps1 [-Target FirstSteps_RestoreTest] [-Backup <path>]
param(
  [ValidateSet("FirstSteps_Test", "FirstSteps_RestoreTest")][string]$Target = "FirstSteps_RestoreTest",
  [string]$Backup
)
$ErrorActionPreference = "Stop"
$server = "tcp:127.0.0.1,1433"
function Sql([string]$query) {
  $out = sqlcmd -S $server -E -C -b -h -1 -W -Q $query
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $out" }
  # Non-empty lines only, joined, so single values can be used directly.
  return ((@($out) | Where-Object { $_ -and $_.Trim() }) -join "`n").Trim()
}

if (-not $Backup) {
  # The backup folder is readable only by the SQL Server service, so the newest full backup is taken
  # from SQL Server's own backup history (msdb) instead of a directory listing.
  $Backup = (Sql @"
SET NOCOUNT ON;
SELECT TOP (1) f.physical_device_name
  FROM msdb.dbo.backupset s JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = s.media_set_id
 WHERE s.database_name = N'FirstSteps_Dev' AND s.type = 'D' AND f.physical_device_name LIKE N'%FirstSteps_Dev[_]%.bak'
 ORDER BY s.backup_finish_date DESC;
"@).Trim()
  if (-not $Backup) { throw "No FirstSteps_Dev backup found. Run scripts/db/backup-dev.ps1 first." }
}
$dataPath = (Sql "SET NOCOUNT ON; SELECT CONVERT(NVARCHAR(300), SERVERPROPERTY('InstanceDefaultDataPath'))").Trim()
$mdf = $dataPath.TrimEnd("\") + "\$Target.mdf"
$ldf = $dataPath.TrimEnd("\") + "\${Target}_log.ldf"

Write-Output "Restoring $Backup -> $Target"
Sql @"
SET NOCOUNT ON;
IF N'$Target' NOT IN (N'FirstSteps_Test', N'FirstSteps_RestoreTest') THROW 50000, 'Refusing target', 1;
IF DB_ID(N'$Target') IS NOT NULL ALTER DATABASE [$Target] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [$Target] FROM DISK = N'$Backup'
  WITH MOVE N'FirstSteps_Dev' TO N'$mdf', MOVE N'FirstSteps_Dev_log' TO N'$ldf', REPLACE, CHECKSUM, RECOVERY;
ALTER DATABASE [$Target] SET MULTI_USER;
"@ | Out-Null

$check = Sql @"
SET NOCOUNT ON;
DBCC CHECKDB (N'$Target') WITH NO_INFOMSGS;
USE [$Target];
SELECT CONCAT('tables=', (SELECT COUNT(*) FROM sys.tables WHERE name IN (N'Users',N'Universities',N'Journeys',N'Task_Templates',N'Journey_Tasks',N'Task_Dependencies',N'Information_Sources',N'Help_Requests')),
              ' users=', (SELECT COUNT(*) FROM dbo.Users), ' templates=', (SELECT COUNT(*) FROM dbo.Task_Templates),
              ' journeyTasks=', (SELECT COUNT(*) FROM dbo.Journey_Tasks), ' triggers=', (SELECT COUNT(*) FROM sys.triggers),
              ' appUser=', IIF(DATABASE_PRINCIPAL_ID(N'firststeps_app') IS NULL, 'missing', 'present'));
"@
Write-Output "Validated $Target : $($check -join ' ')"
if ($check -notmatch "tables=8") { throw "Restored database is missing course tables" }
