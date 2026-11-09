# Rotates FirstSteps app log files written by redirecting `next start` output, for example
#   npx next start -p 3000 >> D:\FirstStepsLogs\firststeps.log 2>&1
# Only files named firststeps*.log in -Folder are touched; anything else is left alone.
#   - the active file is copied to firststeps-yyyyMMdd_HHmmss.log and truncated in place once it is
#     larger than -MaxMb (copy + truncate keeps the writer's open handle valid);
#   - rotated files older than -KeepDays are deleted, but the newest -KeepMin are always kept.
# Logs never contain passwords, tokens or email addresses (src/server/log.ts), but they do contain user
# ids and request ids; -KeepDays (default 30) is the log retention stated in docs/privacy.md.
#   powershell -File scripts/ops/rotate-logs.ps1 -Folder D:\FirstStepsLogs [-WhatIf]
[CmdletBinding(SupportsShouldProcess = $true)]
param([Parameter(Mandatory = $true)][string]$Folder, [int]$MaxMb = 50, [int]$KeepDays = 30, [int]$KeepMin = 5)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $Folder -PathType Container)) { throw "Folder not found: $Folder" }
$active = Join-Path $Folder "firststeps.log"
if ((Test-Path -LiteralPath $active) -and (Get-Item -LiteralPath $active).Length -gt $MaxMb * 1MB) {
  $rotated = Join-Path $Folder ("firststeps-{0:yyyyMMdd_HHmmss}.log" -f (Get-Date))
  if ($PSCmdlet.ShouldProcess($active, "Rotate to $rotated")) {
    Copy-Item -LiteralPath $active -Destination $rotated
    Clear-Content -LiteralPath $active
    Write-Output "Rotated to $rotated"
  }
}
$old = Get-ChildItem -LiteralPath $Folder -File | Where-Object { $_.Name -match '^firststeps-\d{8}_\d{6}\.log$' } |
  Sort-Object Name -Descending | Select-Object -Skip $KeepMin | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
foreach ($f in $old) { if ($PSCmdlet.ShouldProcess($f.FullName, "Delete")) { Remove-Item -LiteralPath $f.FullName; Write-Output "Removed $($f.Name)" } }
