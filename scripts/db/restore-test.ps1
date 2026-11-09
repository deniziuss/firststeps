# Restore test: restores a FirstSteps_Dev backup into a SEPARATE disposable database and validates it.
# - Target: FirstSteps_RestoreTest (default) or FirstSteps_Test. FirstSteps_Dev is never a target.
# - WITH REPLACE only overwrites that disposable target and its own data files (<Target>.mdf/.ldf).
# - Backup: the newest verified full backup recorded by SQL Server (msdb), or -Backup <file>.
# - Checks: RESTORE with CHECKSUM, DBCC CHECKDB, the eight course tables, a schema fingerprint compared
#   with FirstSteps_Dev (tables, columns, types, procedures, triggers, indexes), the app login's database
#   user, and row counts (reported; FirstSteps_Dev may have changed since the backup).
# - Result: %LOCALAPPDATA%\FirstSteps\restore-status.json and exit code 0 (passed) or 1 (failed).
# - Clean-up: the disposable database is kept for inspection and replaced by the next run. It is never
#   dropped by this script (the project forbids DROP DATABASE in scripts).
# Usage: powershell -File scripts/db/restore-test.ps1 [-Target FirstSteps_RestoreTest] [-Backup <path>]
param(
  [ValidateSet("FirstSteps_Test", "FirstSteps_RestoreTest")][string]$Target = "FirstSteps_RestoreTest",
  [string]$Backup
)
$ErrorActionPreference = "Stop"
$server = "tcp:127.0.0.1,1433"
$statusDir = Join-Path $env:LOCALAPPDATA "FirstSteps"
New-Item -ItemType Directory -Force $statusDir | Out-Null
$statusFile = Join-Path $statusDir "restore-status.json"

function Sql([string]$query) {
  $out = sqlcmd -S $server -E -C -b -h -1 -W -Q $query
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $out" }
  # Non-empty lines only, joined, so single values can be used directly.
  return ((@($out) | Where-Object { $_ -and $_.Trim() }) -join "`n").Trim()
}
function Write-Status($result, $message, $details) {
  [ordered]@{ time = (Get-Date).ToUniversalTime().ToString("o"); target = $Target; backup = $Backup; result = $result; message = $message; details = $details } |
    ConvertTo-Json | Set-Content -Encoding utf8 $statusFile
}

# Schema fingerprint: same query in both databases; equal hashes mean the same structure.
$fingerprint = @"
SELECT CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', (
  SELECT STRING_AGG(CONVERT(NVARCHAR(MAX), x.item COLLATE Latin1_General_BIN2), N'|') WITHIN GROUP (ORDER BY x.item COLLATE Latin1_General_BIN2) FROM (
    SELECT CONCAT(o.type, N':', o.name) AS item FROM sys.objects o WHERE o.is_ms_shipped = 0 AND o.type IN ('U','P','TR','V','FN','IF','TF')
    UNION ALL SELECT CONCAT(N'col:', OBJECT_NAME(c.object_id), N'.', c.name, N':', TYPE_NAME(c.user_type_id), N':', c.max_length, N':', c.is_nullable)
      FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
    UNION ALL SELECT CONCAT(N'ix:', OBJECT_NAME(i.object_id), N'.', i.name) FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id WHERE i.name IS NOT NULL
  ) x)), 2)
"@

try {
  if (-not $Backup) {
    # The backup folder is readable only by the SQL Server service, so the newest full backup is taken
    # from SQL Server's own backup history (msdb) instead of a directory listing.
    $Backup = Sql @"
SET NOCOUNT ON;
SELECT TOP (1) f.physical_device_name
  FROM msdb.dbo.backupset s JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = s.media_set_id
 WHERE s.database_name = N'FirstSteps_Dev' AND s.type = 'D' AND f.physical_device_name LIKE N'%FirstSteps_Dev[_]%.bak'
 ORDER BY s.backup_finish_date DESC;
"@
    if (-not $Backup) { throw "No FirstSteps_Dev backup found. Run scripts/db/backup-dev.ps1 first." }
  }
  if ($Backup -notmatch '^[A-Za-z]:\\[^''"]+\.bak$') { throw "Unexpected backup path" }
  $dataPath = Sql "SET NOCOUNT ON; SELECT CONVERT(NVARCHAR(300), SERVERPROPERTY('InstanceDefaultDataPath'))"
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
  $check = ($check -split "`n" | Where-Object { $_ -like "tables=*" }) -join ""
  $restoredSchema = Sql "SET NOCOUNT ON; USE [$Target]; $fingerprint"
  $devSchema = Sql "SET NOCOUNT ON; USE [FirstSteps_Dev]; $fingerprint"
  $devCounts = (Sql "SET NOCOUNT ON; USE [FirstSteps_Dev]; SELECT CONCAT('users=', (SELECT COUNT(*) FROM dbo.Users), ' templates=', (SELECT COUNT(*) FROM dbo.Task_Templates), ' journeyTasks=', (SELECT COUNT(*) FROM dbo.Journey_Tasks))") -split "`n" | Select-Object -Last 1
  $schemaMatches = ($restoredSchema -split "`n" | Select-Object -Last 1) -eq ($devSchema -split "`n" | Select-Object -Last 1)

  Write-Output "Restored : $check"
  Write-Output "Dev now  : $devCounts"
  Write-Output "Schema   : $(if ($schemaMatches) { 'identical to FirstSteps_Dev' } else { 'DIFFERENT from FirstSteps_Dev' })"
  if ($check -notmatch "tables=8") { throw "Restored database is missing course tables" }
  if ($check -notmatch "appUser=present") { throw "Restored database has no application user" }
  if (-not $schemaMatches) { throw "Restored schema differs from FirstSteps_Dev (a migration ran after the backup?)" }
  Write-Status "passed" "restored, CHECKDB clean, schema identical" @{ restored = $check; dev = $devCounts }
  Write-Output "RESTORE TEST PASSED"
} catch {
  Write-Status "failed" $_.Exception.Message $null
  Write-Output "RESTORE TEST FAILED: $($_.Exception.Message)"
  exit 1
}
