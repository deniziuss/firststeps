# Copy-only backup of the local FirstSteps_Dev database, then RESTORE VERIFYONLY.
# Only the local instance and FirstSteps_Dev are used. The file is written by the SQL Server service
# to the instance's default backup folder (outside the repository) and must never be committed.
$ErrorActionPreference = "Stop"
$server = "tcp:127.0.0.1,1433"
$name = "FirstSteps_Dev_{0:yyyyMMdd_HHmmss}.bak" -f (Get-Date)
$sql = @"
SET NOCOUNT ON;
IF DB_ID(N'FirstSteps_Dev') IS NULL THROW 50000, 'FirstSteps_Dev not found', 1;
DECLARE @file NVARCHAR(400) = CONVERT(NVARCHAR(300), SERVERPROPERTY('InstanceDefaultBackupPath')) + N'\$name';
BACKUP DATABASE [FirstSteps_Dev] TO DISK = @file WITH COPY_ONLY, CHECKSUM, INIT;
RESTORE VERIFYONLY FROM DISK = @file WITH CHECKSUM;
SELECT @file AS BackupFile;
"@
sqlcmd -S $server -E -C -b -h -1 -W -Q $sql
if ($LASTEXITCODE -ne 0) { throw "Backup or verification failed" }
