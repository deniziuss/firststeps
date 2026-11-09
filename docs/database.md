# Database

## Schema
`database/migrations/0001_initial_schema.sql` creates the course schema used by the application:

| Object | Count |
|---|---|
| Tables | 8: Users, Universities, Journeys, Task_Templates, Journey_Tasks, Task_Dependencies, Information_Sources, Help_Requests |
| Primary keys / foreign keys | 8 / 10 |
| Indexes (`IX_`) | 4 |
| Triggers | 3: `trg_JourneyTasks_ValidatePrerequisites` (error 51001), `trg_JourneyTasks_CompletionTimestamp`, `trg_HelpRequests_ValidateMentor` (error 51002) |
| Stored procedures | 5: `usp_User_Insert`, `usp_JourneyTask_UpdateStatus`, `usp_HelpRequest_DeleteOpen`, `usp_Journey_CreateWithTasks` (transaction), `usp_Journey_PendingTaskCursorReport` (cursor) |

The schema was originally built and tested for a university database course on a separate server. That server is not used by this project. The migration was checked against an SSMS export of the course database by applying it to an empty database and comparing catalogs: tables, columns, types, defaults, CHECK constraints, foreign keys and indexes are identical, and all trigger and procedure bodies match apart from formatting and comments.

Schema changes are added as new numbered files in `database/migrations/`; existing migrations are not edited. Migrations `0003_prerequisite_applicability.sql` ([Issue 001](issues/001-prerequisite-satisfaction.md)) and `0004_session_version.sql` (persistent session revocation) were approved and applied to the local `FirstSteps_Dev` on 2026-11-09. Proposals waiting for a decision live in `database/proposals/` and are not run by setup (currently `0005_foreign_key_indexes.sql` and `0006_security_infrastructure.sql`); see [security.md](security.md).

### Proposal 0006: security infrastructure (tested, awaiting approval for FirstSteps_Dev)
The eight course tables keep their structure; `dbo.Users` gets one nullable column.

| Object | Purpose | Keys and constraints | Retention |
|---|---|---|---|
| `dbo.Rate_Limit_Buckets` | Persistent fixed-window counters for sign-in, registration, password reset and verification resend | PK `BucketKey` (CHAR(64) HMAC; no email or IP stored), `CHECK Hits >= 0`, index on `WindowEndsAt` | Expired rows purged in batches of 500 |
| `usp_RateLimit_Hit / _Peek / _Reset / _Purge` | Atomic count (UPDLOCK + HOLDLOCK), read, clear, purge | — | — |
| `dbo.Users.EmailVerifiedAt` | When the owner confirmed the address (NULL = unverified) | Existing rows backfilled with `CreatedAt` once | — |
| `dbo.Account_Tokens` | Single-use verification and reset tokens | FK `UserID` → Users **ON DELETE CASCADE**; `UNIQUE TokenHash` (SHA-256); `CHECK Purpose IN ('VerifyEmail','ResetPassword')`; `CHECK ExpiresAt > CreatedAt` | Removed with the user; used or expired rows can be purged later |
| `dbo.Admin_Audit_Events` | Append-only record of administrative changes | FK `AdminUserID` → Users (no cascade: admins with history cannot be deleted); `UNIQUE EventUid`; indexes on time, entity and action; INSTEAD OF UPDATE/DELETE trigger | At least 365 days, enforced by the trigger and `usp_AdminAudit_Purge` (default 730) |

**Testing**
- Applied to `FirstSteps_Test`, a restore of a verified backup; running it twice is harmless.
- `database/tests/0006_verify.sql`: 11/11 PASS (rolled back).
- `04_verify.sql` passes on the same database.
- The CI job applies all migrations plus 0006 to a fresh container.

**Applying it to FirstSteps_Dev (after approval)**
1. Run `scripts/db/backup-dev.ps1`.
2. Run `sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d FirstSteps_Dev -i database/proposals/0006_security_infrastructure.sql`.
3. Move the file to `database/migrations/`.
4. Run `0006_verify.sql` and the E2E suite against `FirstSteps_Dev`.

**Rollback:** `database/rollbacks/0006_rollback.sql`. It deletes the audit history; export it first if it must be kept.

**Disposable databases**
- `FirstSteps_Test` and `FirstSteps_RestoreTest` are created only by `scripts/db/restore-test.ps1` (restore of a `FirstSteps_Dev` backup) or in the CI container.
- They hold copies of local synthetic data and are never deployment targets.
- The app and scripts accept `DB_NAME=FirstSteps_Dev` or `FirstSteps_Test` only. Each has a rollback script in `database/rollbacks/`. Before any schema change, `scripts/db/backup-dev.ps1` makes and verifies a copy-only backup of `FirstSteps_Dev`.

### Content translations (`0002_content_translations.sql`)
Two additional tables hold Turkish text; the eight course tables are unchanged and English stays in them.

| Table | Key | Columns |
|---|---|---|
| `Task_Template_Translations` | (TaskID, LanguageCode) → `Task_Templates` | TaskTitle, Description, UpdatedAt |
| `Information_Source_Translations` | (SourceID, LanguageCode) → `Information_Sources` | SourceTitle, UpdatedAt (deleted with the source) |

`LanguageCode` is limited to `tr` by a CHECK constraint. Queries join the translation for the requested language and fall back with `COALESCE` to English; an `IsFallback` flag lets the task page show a notice when Turkish text is missing. Admins edit translations on the task template page. The migration was applied only to the local `FirstSteps_Dev`; it is not part of the course database.

## Local development database
- SQL Server 2022 Express, instance `SQLEXPRESS`, TCP only on `127.0.0.1:1433`, mixed authentication.
- Database `FirstSteps_Dev`. The application login `firststeps_app` has `db_datareader`, `db_datawriter` and `EXECUTE`; no DDL rights.
- The development server here uses the `Turkish_CI_AS` collation (taken from the Windows locale at install time). In this collation the letters `I` and `i` are not case-insensitive equivalents. The application stores emails in lower case, so sign-in is not affected, but keep this in mind when comparing text in SQL.

| File | Purpose |
|---|---|
| `database/local/00_create_database.sql` | Creates the database and login if missing, turns `AUTO_CLOSE` off; never drops anything |
| `database/migrations/0001_initial_schema.sql` | Schema (applied by setup only to an empty database) |
| `database/local/02_seed_content.sql` | Synthetic pilot content: 1 university, 18 task templates, 6 dependencies, 9 sources (`PendingReview`); no people |
| `database/migrations/0002_content_translations.sql` | Translation tables (applied by setup if missing) |
| `database/local/03_seed_translations.sql` | Turkish drafts for the 18 tasks and 9 sources |
| `database/local/04_verify.sql` | Object counts and behaviour tests, each in its own transaction and rolled back |
| `database/local/05_server_settings.sql` | Instance setting: `min server memory` 512 MB |
| `database/local/configure-sqlexpress.ps1` | Administrator script: mixed authentication, loopback TCP on 1433 |

## Verification (`04_verify.sql`)
Counts: 8 course tables, 8 PKs, 10 FKs, 4 indexes, 3 triggers, 5 procedures, plus 2 translation tables. Latest run (2026-11-08): 10/10 PASS.

| Test | Result |
|---|---|
| Insert procedure with SCOPE_IDENTITY / @@IDENTITY | PASS |
| Transaction procedure creates the journey tasks | PASS |
| Trigger sets CompletedAt | PASS |
| Dependent task completes after its prerequisite | PASS |
| Update procedure: Completed → Pending clears CompletedAt | PASS |
| Delete procedure removes an open request | PASS |
| Cursor procedure report | PASS |
| Trigger 51001 blocks an unmet prerequisite | PASS |
| Trigger 51002 blocks assigning a Student as mentor | PASS |
| UNIQUE prevents adding the same task twice to a journey | PASS |

A `THROW` inside a trigger dooms the transaction (further writes fail with error 3930), so the negative tests run in separate transactions and the application rolls back immediately after such an error.

## Local SQL Server Express settings
During the alpha, pages that run several queries at once (the admin task page) sometimes timed out after 15 s. The cause was the local instance, not the queries:
- Express creates databases with `AUTO_CLOSE ON`, so the first request after an idle period waited for the database to reopen.
- Under memory pressure from other programs SQL Server shrank its query memory to about 15 MB, while these queries asked for 19–33 MB each; they queued on `RESOURCE_SEMAPHORE` until the timeout.

`00_create_database.sql` now turns `AUTO_CLOSE` off and `05_server_settings.sql` sets `min server memory` to 512 MB. Afterwards 24 concurrent admin page loads completed in under a second, cold and after idle, without timeouts. Both settings affect only the local instance.

## Data
`FirstSteps_Dev` contains synthetic data only (`@example.invalid` emails). End-to-end tests create synthetic students, journeys, help requests and templates, and remove them at the end of each run with `scripts/db/cleanup-test-data.mjs`. That script only matches test accounts and inactive test templates; see [testing.md](testing.md#test-data-cleanup).
