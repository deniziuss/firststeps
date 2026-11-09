# Operations: backups, recovery, monitoring and deployment readiness

Each item is marked **Implemented and verified**, **Implemented but not fully tested**, **Prepared, awaiting approval**, **Open issue** or **Not tested**.

## Backups and recovery

**Strategy (local SQL Server Express)**
- A daily copy-only full backup with `CHECKSUM`, followed by `RESTORE VERIFYONLY`.
- Retention: 14 days in a dedicated folder.
- A restore test into a separate database at least once a week and after every schema migration.
- SQL Server Express has no SQL Agent, so backups are scheduled with Windows Task Scheduler.

| Item | Script | State |
|---|---|---|
| Verified copy-only backup | `scripts/db/backup-dev.ps1` | Implemented and verified (run 2026-11-09) |
| Unique file per run; no other file is overwritten (`NOINIT`, timestamped name) | same | Implemented and verified |
| Retention: deletes only `FirstSteps_Dev_*.bak` in the folder given with `-Folder` | same | Implemented but not fully tested (no dedicated folder exists yet; in the default instance folder retention is reported, not applied) |
| Failure detection: `%LOCALAPPDATA%\FirstSteps\backup-status.json` and a non-zero exit code | same | Implemented and verified (success path) |
| Daily schedule | `scripts/db/register-backup-task.ps1` | Prepared, awaiting approval (changes Windows scheduled tasks) |
| Restore test into `FirstSteps_RestoreTest` or `FirstSteps_Test`, then `DBCC CHECKDB`, course tables, counts and app user | `scripts/db/restore-test.ps1` | Implemented and verified: counts matched `FirstSteps_Dev` (4 users, 18 templates, 32 journey tasks). `FirstSteps_Dev` is never a target |

**Protection**
- Backups are written by the SQL Server service to the instance backup folder, which the Windows user cannot even list.
- A dedicated folder (`-Folder`) should grant write access only to the service account and the administrator.
- Backups contain personal data (names, emails, password hashes) and must never be committed or copied to shared drives.

**Recovery runbook (`FirstSteps_Dev` lost or damaged)**
1. Stop the app.
2. Find the newest successful backup in `backup-status.json`, or in SQL Server's history (`msdb.dbo.backupset`).
3. Restore it into `FirstSteps_RestoreTest` with `restore-test.ps1 -Backup <file>` and check the reported counts.
4. If the data is right, an administrator restores the same file over `FirstSteps_Dev` with SSMS or `RESTORE DATABASE … WITH REPLACE`. This is a deliberate manual step; no script does it.
5. Run `database/local/04_verify.sql` (and `database/tests/0006_verify.sql` once 0006 is applied), then start the app and check `/api/ready`.

## Monitoring and logging
**Logs** (`src/server/log.ts`) are one JSON object per line. Fields: `time` (UTC), `level`, `category`, `event`, `requestId` and context.

| Category | Events |
|---|---|
| `auth` | `sign_in`, `sign_in_failed` (reason: unknown account / wrong password / inactive), `sign_in_rate_limited`, `password_changed`, `password_reset_requested`, `password_reset`, `email_verified`, `sign_out_revocation_failed` |
| `rate_limit` | `rate_limited` (scope and count; no email or IP) |
| `admin` | `admin_change` (admin id, action, entity type); the full record is in the audit log |
| `db` | `db_connect_failed` (server and database name, no credentials) |
| `perf` | `slow_query`: any statement over 500 ms, with only its first 80 characters and no parameter values |
| `mail` | `mail_sent`, `mail_failed` (kind and transport; no recipient or body) |
| `health` | `not_ready` (which check failed) |

- **Redaction:** keys that look like passwords, tokens, hashes, cookies or secrets are replaced by `[redacted]`, and email addresses inside messages are masked.
- **Correlation:** every response carries `x-request-id`; the same id appears in the log lines of that request.

**Health checks**

| Endpoint | Checks | Answer |
|---|---|---|
| `GET /api/health` (liveness) | The process answers | `200 {"status":"ok"}` |
| `GET /api/ready` (readiness) | Configuration valid, database reachable within 3 s, security schema present | `200 {"status":"ready"}` or `503 {"status":"unavailable","failed":"config\|database\|schema"}`. No versions, host names or error text |

**Retention guidance**
- Application logs: 30 days. They contain user ids, not names.
- Audit events: at least 365 days, enforced by the database; the default purge keeps 730 days.
- Rate-limit rows: deleted automatically after their window.

**Not connected:** log shipping, alerting and an external error tracker. An uptime check or alerting can be built on the `/api/ready` status and the `level:"error"` lines; no external account was created.

## Deployment readiness (nothing is deployed)
Setting `DEPLOYMENT=public` makes the app refuse to start unless:
- `APP_URL` uses https;
- the mail transport is not the development outbox;
- the database connection is encrypted with a validated certificate;
- `TRUST_PROXY=true`.

| Requirement | State |
|---|---|
| HTTPS-only assumptions: Secure session cookie, HSTS in production builds, https `APP_URL` | Implemented and verified (headers tested); TLS termination is a hosting task: **Open issue** |
| Reverse proxy: rightmost-hop `X-Forwarded-For` parsing, `TRUST_PROXY_HOPS`, request id passed through only from a trusted proxy | Implemented and verified (unit tests) |
| CSP, COOP, frame, content-type, referrer and permissions headers | Implemented and verified. A nonce-based CSP was evaluated and not adopted: it forces dynamic rendering of every page (Cache Components and partial prerendering) and needs nonces for the theme and motion bootstrap scripts |
| Safe redirects: only fixed internal paths; no user-controlled redirect targets | Verified, no issue found |
| Database least privilege: app login has read, write and execute only, no DDL | Implemented and verified (CI readiness check uses this login) |
| Secrets only in environment variables; startup validation names fields, never values | Implemented and verified |
| Persistent rate limits and session revocation | Implemented and verified on `FirstSteps_Test`; on `FirstSteps_Dev` after approval of 0006 |
| The app only accepts a local database server (`DB_SERVER`). A hosted deployment needs an approved change of this rule and a managed SQL Server | **Open issue** (deliberate project rule) |
| Real email delivery, monitoring and alerting, scheduled backups on the host, privacy notice | **Open issue** |

**Hosting outline (for a later, approved deployment)**
- **Windows:** IIS or Caddy as a TLS reverse proxy in front of `next start`, run as a service. Set `TRUST_PROXY=true` and `TRUST_PROXY_HOPS=1`.
- **Linux:** Caddy or nginx with TLS in front of `next start` under systemd, with the same proxy settings.
- **Both:** a separate SQL Server with TLS; secrets in the host's secret store; `/api/ready` used for health probes.
