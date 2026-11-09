# Operations: backups, recovery, monitoring and deployment readiness

Each item is marked **Implemented and verified**, **Implemented but requires configuration**, **Prepared, awaiting approval**, **Open issue** or **Not tested**. Nothing is deployed and no scheduled task is registered.

## Backups and recovery

**Strategy (local SQL Server Express)**
- A daily copy-only full backup with `CHECKSUM`, followed by `RESTORE VERIFYONLY`.
- Retention: 14 days in a dedicated folder, and always at least the newest 3 backups.
- A restore test into a separate database once a week and after every schema migration.
- SQL Server Express has no SQL Agent, so the schedule uses Windows Task Scheduler (prepared, not registered).

| Item | Script | State |
|---|---|---|
| Verified copy-only backup (`COPY_ONLY`, `CHECKSUM`, `NOINIT`, `RESTORE VERIFYONLY`) | `scripts/db/backup-dev.ps1` | Implemented and verified (2026-11-10: 8.1 MB, 0.9 s) |
| Free-space check before writing: the target drive needs at least twice the space used by the database (minimum 512 MB) | same | Implemented and verified (success path; the failure path was seen when the size could not be read: status `failed`, exit 1) |
| Safe names: `FirstSteps_Dev_yyyyMMdd_HHmmss.bak`; `-Folder` must be an absolute local path (no share, quotes or `..`) | same | Implemented and verified |
| Retention: deletes only files whose whole name matches the pattern above, keeps the newest `-KeepMin` (3); other files are reported and left alone | same | Implemented; the same rule was tested in `rotate-logs.ps1` on a scratch folder. **Not tested** on a real backup folder (none exists yet) |
| Status: `%LOCALAPPDATA%\FirstSteps\backup-status.json` with time, result, file, size, database size, free space, duration; exit code 1 on failure | same | Implemented and verified |
| Restore test into `FirstSteps_RestoreTest` (or `FirstSteps_Test`): newest backup from `msdb` history, `RESTORE … WITH CHECKSUM`, `DBCC CHECKDB`, the 8 course tables, the app user, row counts, and a **schema fingerprint** (SHA-256 over tables, columns and types, procedures, triggers, views, functions, indexes) compared with `FirstSteps_Dev` | `scripts/db/restore-test.ps1` | Implemented and verified: fingerprint identical, counts equal (4 users, 18 templates, 32 journey tasks). The detector was checked: `FirstSteps_Test` (with 0006) has a different fingerprint |
| Restore status: `restore-status.json`, exit code 1 on any failed check | same | Implemented and verified (a failing run was recorded during development: collation error, status `failed`) |
| Schedule: daily backup, weekly restore test, health check every 15 min | `scripts/db/register-backup-task.ps1` (`-WhatIf` shows without registering) | **Prepared, awaiting approval** (changes Windows scheduled tasks) |

**Clean-up rules**
- `FirstSteps_Dev` is never a restore target (the script only accepts `FirstSteps_RestoreTest` and `FirstSteps_Test`).
- The disposable target is replaced by the next run, not dropped: the project forbids `DROP DATABASE` in scripts.
- No unrecognised backup file is ever deleted.

**Backup folder (one-time preparation, by the owner)**
1. Create a folder on a local drive, for example `D:\FirstStepsBackups`, outside the repository and outside synced folders.
2. Grant *Modify* to the SQL Server service account (`NT SERVICE\MSSQL$SQLEXPRESS`) and to administrators; remove inherited access for other users.
3. Run `powershell -File scripts/db/backup-dev.ps1 -Folder D:\FirstStepsBackups` once and check `backup-status.json`.

Backups contain personal data (names, emails, password hashes). They must never be committed, synced to shared drives or kept longer than the retention (see `docs/privacy.md`).

**Recovery runbook (`FirstSteps_Dev` lost or damaged)**
1. Stop the app.
2. Find the newest successful backup in `backup-status.json` or in SQL Server's history (`msdb.dbo.backupset`).
3. Run `restore-test.ps1 -Backup <file>`; it must end with `RESTORE TEST PASSED`. If `FirstSteps_Dev` is gone, the schema comparison fails by design; check the counts manually.
4. If the data is right, an administrator restores the same file over `FirstSteps_Dev` with SSMS or `RESTORE DATABASE … WITH REPLACE`. This is a deliberate manual step; no script does it.
5. Run `database/local/04_verify.sql` (and `database/tests/0006_verify.sql` once 0006 is applied), start the app, then check `/api/ready` and `scripts/ops/health-check.ps1`.

Recovery point: up to 24 hours of changes (daily backup). Recovery time: minutes at the current size (restore of 8 MB took under 5 s).

## Monitoring and logging

**Logs** (`src/server/log.ts`) are one JSON object per line. Fields: `time` (UTC), `level`, `category`, `event`, `requestId` and context.

| Category | Events |
|---|---|
| `auth` | `sign_in` and `sign_in_failed` (reason; `ms` = server time of the action), `sign_in_rate_limited`, `password_changed`, `password_reset_requested`, `password_reset`, `email_verified`, `data_exported`, `sign_out_revocation_failed` |
| `rate_limit` | `rate_limited` (scope and count; no email or IP) |
| `admin` | `admin_change` (admin id, action, entity type); the full record is in the audit log |
| `db` | `db_connect_failed` (server and database name, no credentials) |
| `perf` | `slow_query`: any statement over 500 ms, with only its first 80 characters and no parameter values |
| `mail` | `mail_sent` (kind, transport, attempts, provider message id), `mail_failed` (kind, transport, attempts, SMTP code). Never the recipient or body |
| `health` | `not_ready` (which check failed) |

- **Redaction:** keys that look like passwords, tokens, hashes, cookies or secrets become `[redacted]`; email addresses inside messages are masked.
- **Correlation:** every response carries `x-request-id`; the same id appears in the app's log lines and, behind the prepared proxies, in the access log.
- **Error categories:** `level` + `category` + `event`, plus `errorName`, `errorCode` and `sqlNumber` for errors.

**Health checks**

| Endpoint | Checks | Answer |
|---|---|---|
| `GET /api/health` (liveness) | The process answers | `200 {"status":"ok"}` |
| `GET /api/ready` (readiness) | Configuration valid, database reachable within 3 s, security schema present | `200 {"status":"ready"}` or `503 {"status":"unavailable","failed":"config\|database\|schema"}` |

**Metrics** (`GET /api/metrics`, Prometheus text format). **Implemented and verified** (unit tests, E2E, CI). **Requires configuration**: set `METRICS_TOKEN` (32+ characters); without it the endpoint answers 404. The request needs `Authorization: Bearer <token>`; the comparison is constant-time. The prepared proxy configs answer 404 for this path, so it is reachable only on the host.

| Metric | Meaning |
|---|---|
| `firststeps_log_events_total{level,category,event}` | Every structured log event: failed sign-ins, rate limiting, mail failures, errors, admin changes |
| `firststeps_db_statement_duration_ms` (histogram 5/25/100/500/2000 ms) | Database statement latency |
| `firststeps_db_statement_failures_total` | Failed statements |
| `firststeps_db_pool_connections{state=open\|idle\|in_use\|waiting}` | Connection pool |
| `firststeps_process_memory_bytes{type=rss\|heap_used}`, `firststeps_process_uptime_seconds` | Process |

The overhead is a map increment per log line and a few array increments per statement. Labels are fixed strings chosen by the code, at most 500 series. HTTP request duration comes from the reverse proxy access log (`$request_time` in nginx, the JSON log in Caddy), because the Next.js proxy cannot see when a response ends.

**Health and alert check** (`scripts/ops/health-check.ps1`). Local only, no external service. Exit code 1 and a line in `alerts.jsonl` on any alert. **Implemented and verified**: alert when the app was down; all checks `ok` against a running production build with metrics and a log file.

| Check | Alert when |
|---|---|
| `ready` | `/api/ready` is not 200 within 5 s (database down, wrong configuration) |
| `backup` | Last backup failed, or none for 26 hours |
| `restore` | Last restore test failed (alert) or is older than 8 days (warning) |
| `disk` | Less than 5 GB free on the system drive or the SQL Server data drive |
| `metrics` | Since the previous check: more than 20 error events or DB failures, or more than 50 failed sign-ins (abnormal authentication) |
| `log` | More than 20 error lines in the last 15 minutes of the app log |

**Log rotation** (`scripts/ops/rotate-logs.ps1`): for logs written by redirecting `next start` to `firststeps.log`. Copy-and-truncate above 50 MB, rotated files kept 30 days (and always the newest 5), only `firststeps*.log` touched. **Implemented and verified** on a scratch folder. Behind nginx or Caddy the access logs are rotated by logrotate or by Caddy's `roll_size`/`roll_keep`.

**Retention**
- Application logs: 30 days. They contain user ids and request ids, not names or emails.
- Audit events: at least 365 days, enforced by the database; the default purge keeps 730 days.
- Rate-limit rows and used or expired tokens: removed by `scripts/db/maintenance.mjs` (below).

**Not connected:** no external log shipping, error tracker or paging service (none approved). The metrics endpoint and the health check work with a self-hosted Prometheus or with Task Scheduler.

## Database maintenance (`scripts/db/maintenance.mjs`)
Dry run by default. With `--apply` each batch of 500 rows is its own short transaction, and every run stops after `--max-batches` (50) per table. Re-running continues where it stopped.

| Task | Rule | Verified (FirstSteps_Test) |
|---|---|---|
| Rate-limit windows that ended | `usp_RateLimit_Purge` | 238 rows, then 1,200 rows in 3 batches; second run 0 |
| One-time tokens | Used or expired more than `--token-days` (7) days ago | 2 old tokens removed, the recent expired one kept |
| Audit events | Only with `--audit-days N`, N ≥ 365, only via `usp_AdminAudit_Purge` | `--audit-days 30` refused by the script; 365: 0 removed (all events are recent) |
| Report | Database size, rows and space per table; index fragmentation and stale statistics when the login may read them | The app login lacks `VIEW DATABASE STATE`; the report says so instead of failing |

Indexes are not rebuilt and statistics are not updated by the script: no index has 100 pages yet, and doing so needs more than the app's permissions.

## Deployment readiness (nothing is deployed)
Setting `DEPLOYMENT=public` makes the app refuse to start unless:
- `APP_URL` uses https;
- the mail transport is not the development outbox, and SMTP keeps TLS required;
- the database connection is encrypted with a validated certificate;
- `TRUST_PROXY=true`.

At request time (`src/lib/deployment.ts`, only with `DEPLOYMENT=public`):
- a request whose `Host` is not the `APP_URL` host gets **421**, which blocks host-header attacks and requests that bypass the proxy;
- a request the proxy marks as `X-Forwarded-Proto: http` is redirected with **308** to the same path on `APP_URL`. The target is always built from `APP_URL`, never from the request, so it cannot become an open redirect (unit-tested, including `//evil.example` paths).

Local development (`DEPLOYMENT=local`, the default) skips these checks and works on plain http.

| Requirement | State |
|---|---|
| HTTPS: Secure session cookie, HSTS in production builds, https `APP_URL`, HTTP → HTTPS redirect at the proxy and in the app | Implemented and verified (headers E2E, deployment unit tests). **Requires configuration**: certificate and proxy on a host |
| Reverse proxy (`deploy/Caddyfile`, `deploy/nginx/firststeps.conf`): TLS 1.2+, forwarding headers overwritten (never passed through from clients), request id, 1 MB body limit, header/body/upstream timeouts, unknown hosts rejected, metrics not exposed, app only on 127.0.0.1:3000, SQL Server never routed | **Prepared** (not deployed; syntax not checked by the real servers) |
| CSRF: Server Actions check `Origin` against `Host`; the only GET with data (`/api/account/export`) needs the session cookie (`SameSite=Lax`) and sends no CORS headers | Implemented and verified |
| CORS: no `Access-Control-Allow-*` header anywhere, so other origins cannot read responses | Verified |
| CSP and other headers | Implemented and verified; a nonce-based CSP was evaluated and not adopted (it forces dynamic rendering of every page). Unchanged in this round |
| Database least privilege: read, write and execute only, no DDL | Implemented and verified (CI uses this login for readiness, security checks and maintenance) |
| Secrets only in environment variables; startup validation names fields, never values | Implemented and verified |
| The app only accepts a local database server (`DB_SERVER`). A hosted deployment needs an approved change of this rule | **Open issue** (deliberate project rule) |
| Real email provider, host, certificates, scheduled tasks | **Prepared, awaiting approval** |

**Hosting outline (for a later, approved deployment)**
- **Windows:** Caddy (or IIS) as the TLS reverse proxy in front of `next start`, run as a service; Task Scheduler for the three prepared tasks.
- **Linux:** Caddy or nginx in front of `next start` under systemd; logrotate for access logs.
- **Both:** `DEPLOYMENT=public`, `APP_URL=https://…`, `TRUST_PROXY=true`, `TRUST_PROXY_HOPS=1`, `METRICS_TOKEN`; a separate SQL Server with TLS; secrets in the host's secret store; `/api/ready` for health probes.
