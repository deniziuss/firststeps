# PREPARED, NOT RUN AUTOMATICALLY: registers a daily Windows scheduled task for the FirstSteps_Dev
# backup. Changing operating-system scheduled tasks needs the owner's approval; run it yourself:
#
#   powershell -File scripts/db/register-backup-task.ps1 -Folder D:\FirstStepsBackups -At 02:30
#
# The task runs scripts/db/backup-dev.ps1 as the current user (Windows authentication to the local
# SQL Server). Check results in %LOCALAPPDATA%\FirstSteps\backup-status.json, or with
#   Get-ScheduledTaskInfo -TaskName "FirstSteps backup"
# Remove it with: Unregister-ScheduledTask -TaskName "FirstSteps backup"
param([Parameter(Mandatory = $true)][string]$Folder, [string]$At = "02:30", [int]$KeepDays = 14)
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "backup-dev.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Folder `"$Folder`" -KeepDays $KeepDays"
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "FirstSteps backup" -Action $action -Trigger $trigger -Settings $settings -Description "Daily verified copy-only backup of FirstSteps_Dev"
Write-Output "Registered 'FirstSteps backup' daily at $At."
