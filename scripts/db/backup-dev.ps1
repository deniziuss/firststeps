# Copy-only full backup of the local FirstSteps_Dev database, verified with RESTORE VERIFYONLY.
# Only the local instance and FirstSteps_Dev are used. Files are written by the SQL Server service
# outside the repository and never overwrite another file (unique timestamped name, no INIT on an
# existing file).
#
#   powershell -File scripts/db/backup-dev.ps1                      # instance default backup folder
#   powershell -File scripts/db/backup-dev.ps1 -Folder D:\FirstStepsBackups -KeepDays 14 -KeepMin 3
#
# -Folder: a dedicated local folder (absolute path) that the SQL Server service account can write to.
#   Prepare it once (see docs/operations.md, "Backup folder"). Retention (-KeepDays) deletes ONLY files
#   whose whole name matches FirstSteps_Dev_yyyyMMdd_HHmmss.bak, and always keeps the newest -KeepMin
#   backups even when they are old. Any other file in the folder is left alone. In the instance default
#   folder retention is reported, not applied (the Windows user cannot list it, which also protects the
#   backups).
# Space: before the backup the free space of the target drive must be at least twice the space used by
#   the database (the backup is not compressed on Express); otherwise the run fails without writing.
# Status: every run writes %LOCALAPPDATA%\FirstSteps\backup-status.json (time, result, file, sizes, free
#   space, duration) and exits with a non-zero code on failure, so a scheduler or the health check
#   (scripts/ops/health-check.ps1) can detect failed or missing runs.
param([string]$Folder, [int]$KeepDays = 14, [int]$KeepMin = 3)
$ErrorActionPreference = "Stop"
$server = "tcp:127.0.0.1,1433"
$statusDir = Join-Path $env:LOCALAPPDATA "FirstSteps"
New-Item -ItemType Directory -Force $statusDir | Out-Null
$statusFile = Join-Path $statusDir "backup-status.json"
$started = Get-Date

function Write-Status($result, $message, $details) {
  [ordered]@{
    time = (Get-Date).ToUniversalTime().ToString("o"); database = "FirstSteps_Dev"; result = $result; message = $message
    durationSeconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 1); details = $details
  } | ConvertTo-Json | Set-Content -Encoding utf8 $statusFile
}
function Sql([string]$query) {
  $out = sqlcmd -S $server -E -C -b -h -1 -W -Q $query
  if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed: $out" }
  return ((@($out) | Where-Object { $_ -and $_.Trim() }) -join "`n").Trim()
}

try {
  if ($Folder) {
    # A plain absolute local path: no quotes, no UNC share, no relative segments.
    if ($Folder -notmatch '^[A-Za-z]:\\[^''"*?<>|]*$' -or $Folder -match '\\\.\.?(\\|$)') { throw "-Folder must be an absolute local path such as D:\FirstStepsBackups" }
    if (-not (Test-Path -LiteralPath $Folder -PathType Container)) { throw "Backup folder $Folder does not exist (create it and grant the SQL Server service write access)" }
    $folderPath = $Folder.TrimEnd("\")
  } else {
    $folderPath = Sql "SET NOCOUNT ON; SELECT CONVERT(NVARCHAR(300), SERVERPROPERTY('InstanceDefaultBackupPath'))"
  }

  # Free space on the target drive vs. space used by the database (pages in use, data + log).
  $usedMb = [double]((Sql "SET NOCOUNT ON; USE [FirstSteps_Dev]; SELECT CAST(SUM(FILEPROPERTY(name, 'SpaceUsed')) * 8 / 1024.0 AS DECIMAL(12,1)) FROM sys.database_files") -split "`n" | Select-Object -Last 1)
  $drive = Get-PSDrive -Name $folderPath.Substring(0, 1)
  $freeMb = [math]::Round($drive.Free / 1MB, 0)
  if ($freeMb -lt [math]::Max(2 * $usedMb, 512)) { throw "Not enough free space on $($drive.Name): ($freeMb MB free, database uses $usedMb MB)" }

  $name = "FirstSteps_Dev_{0:yyyyMMdd_HHmmss}.bak" -f (Get-Date)
  $file = "$folderPath\$name"
  $out = Sql @"
SET NOCOUNT ON;
IF DB_ID(N'FirstSteps_Dev') IS NULL THROW 50000, 'FirstSteps_Dev not found', 1;
BACKUP DATABASE [FirstSteps_Dev] TO DISK = N'$($file.Replace("'", "''"))' WITH COPY_ONLY, CHECKSUM, NOINIT, NAME = N'FirstSteps_Dev copy-only';
RESTORE VERIFYONLY FROM DISK = N'$($file.Replace("'", "''"))' WITH CHECKSUM;
SELECT TOP (1) CONCAT('size=', CAST(s.backup_size / 1048576.0 AS DECIMAL(12,1)))
  FROM msdb.dbo.backupset s JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = s.media_set_id
 WHERE f.physical_device_name = N'$($file.Replace("'", "''"))' ORDER BY s.backup_finish_date DESC;
"@
  $sizeMb = [double](($out -split "`n" | Where-Object { $_ -like "size=*" } | Select-Object -Last 1) -replace "size=", "")
  Write-Output "Verified backup: $file ($sizeMb MB, $freeMb MB free before the backup)"

  $removed = @()
  if ($Folder) {
    $pattern = '^FirstSteps_Dev_\d{8}_\d{6}\.bak$'
    $ours = Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Name -match $pattern } | Sort-Object Name -Descending
    $candidates = $ours | Select-Object -Skip $KeepMin | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
    foreach ($f in $candidates) { Remove-Item -LiteralPath $f.FullName; $removed += $f.Name; Write-Output "Retention: removed $($f.Name)" }
    $other = @(Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Name -notmatch $pattern }).Count
    if ($other -gt 0) { Write-Output "Retention: $other other file(s) in the folder were left untouched." }
  } else {
    Write-Output "Retention: not applied in the instance default folder (use -Folder for automatic retention)."
  }
  Write-Status "success" "verified with RESTORE VERIFYONLY" ([ordered]@{ file = $file; sizeMb = $sizeMb; databaseUsedMb = $usedMb; freeMbBefore = $freeMb; removed = $removed })
} catch {
  Write-Status "failed" $_.Exception.Message $null
  Write-Output "BACKUP FAILED: $($_.Exception.Message)"
  exit 1
}
