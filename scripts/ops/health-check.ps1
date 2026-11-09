# FirstSteps health and alert check. Local only: no external service, no account, no OS change.
#
#   powershell -File scripts/ops/health-check.ps1 [-AppUrl http://127.0.0.1:3000] [-LogFile <app log>]
#
# Checks (each "ok", "warn" or "alert"):
#   ready      GET <AppUrl>/api/ready answers 200 within 5 s (database reachable, schema present)
#   backup     %LOCALAPPDATA%\FirstSteps\backup-status.json: last run succeeded and is < -BackupMaxHours old
#   restore    restore-status.json: last restore test passed and is < 8 days old (warn otherwise)
#   disk       free space on the system drive and the SQL Server data drive >= -MinFreeGb
#   metrics    (when METRICS_TOKEN is set in the environment) deltas since the previous check:
#              error-level log events, failed sign-ins, rate-limited requests, database failures
#   log        (with -LogFile) error lines in the last -LogMinutes minutes of a JSON-lines app log
# Output: %LOCALAPPDATA%\FirstSteps\health-status.json (latest), alerts appended to alerts.jsonl in the
# same folder, and exit code 0 (no alert) or 1 (at least one alert) for a scheduler or monitor.
param(
  [string]$AppUrl = "http://127.0.0.1:3000",
  [int]$BackupMaxHours = 26,
  [int]$MinFreeGb = 5,
  [string]$LogFile,
  [int]$LogMinutes = 15,
  [int]$MaxErrors = 20,
  [int]$MaxFailedSignIns = 50
)
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "FirstSteps"
New-Item -ItemType Directory -Force $dir | Out-Null
$statusFile = Join-Path $dir "health-status.json"
$checks = [ordered]@{}
function Check([string]$name, [string]$state, [string]$detail) { $checks[$name] = [ordered]@{ state = $state; detail = $detail } }
function Age-Hours($time) { ((Get-Date).ToUniversalTime() - ([datetime]$time).ToUniversalTime()).TotalHours }

$previous = $null
if (Test-Path $statusFile) { try { $previous = Get-Content $statusFile -Raw | ConvertFrom-Json } catch { } }

# ready
try {
  $response = Invoke-WebRequest -Uri "$($AppUrl.TrimEnd('/'))/api/ready" -UseBasicParsing -TimeoutSec 5
  Check "ready" "ok" "HTTP $($response.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Check "ready" "alert" $(if ($code) { "HTTP $code" } else { "no answer" })
}

# backup and restore status
foreach ($item in @(@{ name = "backup"; file = "backup-status.json"; good = "success"; maxHours = $BackupMaxHours; level = "alert" },
                    @{ name = "restore"; file = "restore-status.json"; good = "passed"; maxHours = 24 * 8; level = "warn" })) {
  $path = Join-Path $dir $item.file
  if (-not (Test-Path $path)) { Check $item.name $item.level "no status file (never run)"; continue }
  $s = Get-Content $path -Raw | ConvertFrom-Json
  $age = [math]::Round((Age-Hours $s.time), 1)
  if ($s.result -ne $item.good) { Check $item.name "alert" "last run $($s.result): $($s.message)" }
  elseif ($age -gt $item.maxHours) { Check $item.name $item.level "last successful run $age h ago" }
  else { Check $item.name "ok" "$($s.result) $age h ago" }
}

# disk space (system drive and the SQL Server data drive)
$drives = @($env:SystemDrive.Substring(0, 1))
try {
  $data = (sqlcmd -S tcp:127.0.0.1,1433 -E -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(NVARCHAR(300), SERVERPROPERTY('InstanceDefaultDataPath'))" | Select-Object -First 1)
  if ($LASTEXITCODE -eq 0 -and $data -match '^[A-Za-z]:') { $drives += $data.Substring(0, 1) }
} catch { }
$low = @(); $free = @()
foreach ($d in ($drives | Sort-Object -Unique)) {
  $gb = [math]::Round((Get-PSDrive -Name $d).Free / 1GB, 1)
  $free += "${d}: $gb GB"
  if ($gb -lt $MinFreeGb) { $low += $d }
}
Check "disk" $(if ($low.Count) { "alert" } else { "ok" }) ($free -join ", ")

# metrics deltas (counters reset on restart: a negative delta means a restart, reported as 0)
$counters = $null
if ($env:METRICS_TOKEN) {
  try {
    $text = (Invoke-WebRequest -Uri "$($AppUrl.TrimEnd('/'))/api/metrics" -UseBasicParsing -TimeoutSec 5 -Headers @{ Authorization = "Bearer $env:METRICS_TOKEN" }).Content
    $sum = { param($pattern) ($text -split "`n" | Where-Object { $_ -match $pattern } | ForEach-Object { [double]($_ -split " ")[-1] } | Measure-Object -Sum).Sum }
    $counters = [ordered]@{
      errors = & $sum '^firststeps_log_events_total\{level="error"'
      failedSignIns = & $sum 'event="sign_in_failed"'
      rateLimited = & $sum 'event="(sign_in_rate_limited|rate_limited)"'
      dbFailures = & $sum '^firststeps_db_statement_failures_total '
    }
    $delta = [ordered]@{}
    foreach ($k in $counters.Keys) {
      $before = if ($previous.counters) { [double]$previous.counters.$k } else { 0 }
      $delta[$k] = [math]::Max(0, $counters[$k] - $before)
    }
    $state = if ($delta.errors -gt $MaxErrors -or $delta.dbFailures -gt $MaxErrors -or $delta.failedSignIns -gt $MaxFailedSignIns) { "alert" } else { "ok" }
    Check "metrics" $state (($delta.GetEnumerator() | ForEach-Object { "$($_.Key) +$($_.Value)" }) -join ", ")
  } catch { Check "metrics" "warn" "metrics endpoint not readable" }
}

# app log (JSON lines): error events in the last minutes
if ($LogFile) {
  if (-not (Test-Path -LiteralPath $LogFile)) { Check "log" "warn" "log file not found" }
  else {
    $since = (Get-Date).ToUniversalTime().AddMinutes(-$LogMinutes)
    $errors = 0
    foreach ($line in Get-Content -LiteralPath $LogFile -Tail 5000) {
      if ($line -notmatch '"level":"error"') { continue }
      try { if (([datetime]($line | ConvertFrom-Json).time).ToUniversalTime() -ge $since) { $errors++ } } catch { }
    }
    Check "log" $(if ($errors -gt $MaxErrors) { "alert" } else { "ok" }) "$errors error line(s) in $LogMinutes min"
  }
}

$alerts = @($checks.GetEnumerator() | Where-Object { $_.Value.state -eq "alert" } | ForEach-Object { $_.Key })
$now = (Get-Date).ToUniversalTime().ToString("o")
[ordered]@{ time = $now; result = $(if ($alerts.Count) { "alert" } else { "ok" }); checks = $checks; counters = $counters } |
  ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 $statusFile
foreach ($name in $alerts) {
  ([ordered]@{ time = $now; check = $name; detail = $checks[$name].detail } | ConvertTo-Json -Compress) | Add-Content -Encoding utf8 (Join-Path $dir "alerts.jsonl")
}
$checks.GetEnumerator() | ForEach-Object { "{0,-8} {1,-5} {2}" -f $_.Key, $_.Value.state, $_.Value.detail }
if ($alerts.Count) { Write-Output "ALERT: $($alerts -join ', ')"; exit 1 }
Write-Output "HEALTH OK"
