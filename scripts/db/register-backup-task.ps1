# PREPARED, NOT RUN AUTOMATICALLY: registers Windows scheduled tasks for FirstSteps operations.
# Changing operating-system scheduled tasks needs the owner's approval; run it yourself:
#
#   powershell -File scripts/db/register-backup-task.ps1 -Folder D:\FirstStepsBackups
#   powershell -File scripts/db/register-backup-task.ps1 -Folder D:\FirstStepsBackups -WhatIf   # show only
#
# Tasks (all run as the current user; Windows authentication to the local SQL Server):
#   "FirstSteps backup"        daily at -At       scripts/db/backup-dev.ps1 -Folder <Folder> -KeepDays <KeepDays>
#   "FirstSteps restore test"  weekly, Sunday     scripts/db/restore-test.ps1 (into FirstSteps_RestoreTest only)
#   "FirstSteps health check"  every 15 minutes   scripts/ops/health-check.ps1 (writes health-status.json)
# Results: %LOCALAPPDATA%\FirstSteps\{backup,restore,health}-status.json and Get-ScheduledTaskInfo.
# Remove: Unregister-ScheduledTask -TaskName "FirstSteps backup" (and the other two names).
[CmdletBinding(SupportsShouldProcess = $true)]
param([Parameter(Mandatory = $true)][string]$Folder, [string]$At = "02:30", [int]$KeepDays = 14, [string]$RestoreAt = "03:30")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
function Action([string]$script, [string]$arguments) {
  New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $root $script)`" $arguments"
}
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
$tasks = @(
  @{ Name = "FirstSteps backup"; Action = (Action "db\backup-dev.ps1" "-Folder `"$Folder`" -KeepDays $KeepDays"); Trigger = (New-ScheduledTaskTrigger -Daily -At $At); Description = "Daily verified copy-only backup of FirstSteps_Dev" },
  @{ Name = "FirstSteps restore test"; Action = (Action "db\restore-test.ps1" ""); Trigger = (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $RestoreAt); Description = "Weekly restore of the newest FirstSteps_Dev backup into FirstSteps_RestoreTest" },
  @{ Name = "FirstSteps health check"; Action = (Action "ops\health-check.ps1" ""); Trigger = (New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 15)); Description = "FirstSteps readiness, backup age, disk space and log anomalies" }
)
foreach ($task in $tasks) {
  if ($PSCmdlet.ShouldProcess($task.Name, "Register scheduled task")) {
    Register-ScheduledTask -TaskName $task.Name -Action $task.Action -Trigger $task.Trigger -Settings $settings -Description $task.Description | Out-Null
    Write-Output "Registered '$($task.Name)'."
  }
}
