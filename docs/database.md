# Database

## Schema
`database/migrations/0001_initial_schema.sql` creates the full schema used by the application:

| Object | Count |
|---|---|
| Tables | 8: Users, Universities, Journeys, Task_Templates, Journey_Tasks, Task_Dependencies, Information_Sources, Help_Requests |
| Primary keys / foreign keys | 8 / 10 |
| Indexes (`IX_`) | 4 |
| Triggers | 3: `trg_JourneyTasks_ValidatePrerequisites` (error 51001), `trg_JourneyTasks_CompletionTimestamp`, `trg_HelpRequests_ValidateMentor` (error 51002) |
| Stored procedures | 5: `usp_User_Insert`, `usp_JourneyTask_UpdateStatus`, `usp_HelpRequest_DeleteOpen`, `usp_Journey_CreateWithTasks` (transaction), `usp_Journey_PendingTaskCursorReport` (cursor) |

The schema was originally built and tested for a university database course on a separate server. That server is not used by this project. The migration was checked against an SSMS export of the course database by applying it to an empty database and comparing catalogs: tables, columns, types, defaults, CHECK constraints, foreign keys and indexes are identical, and all trigger and procedure bodies match apart from formatting and comments.

Schema changes are added as new numbered files in `database/migrations/`; existing migrations are not edited.

## Local development database
- SQL Server 2022 Express, instance `SQLEXPRESS`, TCP only on `127.0.0.1:1433`, mixed authentication.
- Database `FirstSteps_Dev`. The application login `firststeps_app` has `db_datareader`, `db_datawriter` and `EXECUTE`; no DDL rights.
- The development server here uses the `Turkish_CI_AS` collation (taken from the Windows locale at install time). In this collation the letters `I` and `i` are not case-insensitive equivalents. The application stores emails in lower case, so sign-in is not affected, but keep this in mind when comparing text in SQL.

| File | Purpose |
|---|---|
| `database/local/00_create_database.sql` | Creates the database and login if missing; never drops anything |
| `database/migrations/0001_initial_schema.sql` | Schema (applied by setup only to an empty database) |
| `database/local/02_seed_content.sql` | Synthetic pilot content: 1 university, 18 task templates, 6 dependencies, 9 sources (`PendingReview`); no people |
| `database/local/03_verify.sql` | Object counts and behaviour tests, each in its own transaction and rolled back |
| `database/local/configure-sqlexpress.ps1` | Administrator script: mixed authentication, loopback TCP on 1433 |

## Verification (`03_verify.sql`)
Counts: 8 tables, 8 PKs, 10 FKs, 4 indexes, 3 triggers, 5 procedures.

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

## Data
`FirstSteps_Dev` contains synthetic data only (`@example.invalid` emails). End-to-end tests add new synthetic students, journeys and help requests on every run and deactivate the template they create.
