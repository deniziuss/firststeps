# Copy-only full backup of the local FirstSteps_Dev database, verified with RESTORE VERIFYONLY.
# Only the local instance and FirstSteps_Dev are used. Files are written by the SQL Server service
# outside the repository and never overwrite another file (unique timestamped name, no INIT on an
# existing file).
#
#   powershell -File scripts/db/backup-dev.ps1                      # instance default backup folder
#   powershell -File scripts/db/backup-dev.ps1 -Folder D:\FirstStepsBackups -KeepDays 14
#
# -Folder: a dedicated folder that the SQL Server service account can write to (prepare it once with
#   the right permissions). Retention (-KeepDays) deletes ONLY files named FirstSteps_Dev_*.bak in that
#   folder. In the instance default folder retention is reported, not applied (the Windows user cannot
#   list it, which also protects the backups).
# Status: every run writes %LOCALAPPDATA%\FirstSteps\backup-status.json (time, result, file, size) and
#   exits with a non-zero code on failure, so a scheduler or monitoring check can detect failed runs.
param([string]$Folder, [int]$KeepDays = 14)
$ErrorActionPreference = "Stop"
$server = "tcp:127.0.0.1,1433"
$statusDir = Join-Path $env:LOCALAPPDATA "FirstSteps"
New-Item -ItemType Directory -Force $statusDir | Out-Null
$statusFile = Join-Path $statusDir "backup-status.json"

function Write-Status($result, $file, $message) {
  [ordered]@{ time = (Get-Date).ToUniversalTime().ToString("o"); database = "FirstSteps_Dev"; result = $result; file = $file; message = $message } |
    ConvertTo-Json | Set-Content -Encoding utf8 $statusFile
}

try {
  $name = "FirstSteps_Dev_{0:yyyyMMdd_HHmmss}.bak" -f (Get-Date)
  $target = if ($Folder) { "N'" + ($Folder.TrimEnd("\") + "\" + $name).Replace("'", "''") + "'" } else { "CONVERT(NVARCHAR(300), SERVERPROPERTY('InstanceDefaultBackupPath')) + N'\$name'" }
  $sql = @"
SET NOCOUNT ON;
IF DB_ID(N'FirstSteps_Dev') IS NULL THROW 50000, 'FirstSteps_Dev not found', 1;
DECLARE @file NVARCHAR(400) = $target;
BACKUP DATABASE [FirstSteps_Dev] TO DISK = @file WITH COPY_ONLY, CHECKSUM, NOINIT, NAME = N'FirstSteps_Dev copy-only';
RESTORE VERIFYONLY FROM DISK = @file WITH CHECKSUM;
SELECT @file AS BackupFile;
"@
  $out = sqlcmd -S $server -E -C -b -h -1 -W -Q $sql
  if ($LASTEXITCODE -ne 0) { throw "Backup or verification failed: $out" }
  $file = (@($out) | Where-Object { $_ -like "*FirstSteps_Dev_*.bak" } | Select-Object -Last 1).Trim()
  Write-Output "Verified backup: $file"

  if ($Folder) {
    $old = Get-ChildItem -Path $Folder -Filter "FirstSteps_Dev_*.bak" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
    foreach ($f in $old) { Remove-Item -LiteralPath $f.FullName; Write-Output "Retention: removed $($f.Name)" }
  } else {
    Write-Output "Retention: not applied in the instance default folder (use -Folder for automatic retention)."
  }
  Write-Status "success" $file "verified with RESTORE VERIFYONLY"
} catch {
  Write-Status "failed" $null $_.Exception.Message
  Write-Error $_.Exception.Message
  exit 1
}
