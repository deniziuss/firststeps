# Architecture

```
Browser (Student / Mentor / Admin)
  │
Next.js App Router ── server components (pages) + server actions (forms)
  │   src/server/dal.ts      session → user (role and active flag read from the DB on every request), requireUser / requireRole
  │   src/lib/validation.ts  Zod input validation
  │
src/domain/          pure TypeScript business rules, unit tested
  │
src/server/repositories/   parameterized queries and stored procedure calls (ownership is a required parameter)
  │   src/server/db.ts     one mssql connection pool: query / execute / procedure / withTransaction
  │
SQL Server (local FirstSteps_Dev) ── PK/FK/UNIQUE/CHECK + 3 triggers + 5 procedures as the last line of defence
```

One application, no microservices, no second database, no ORM.

## Decisions

### Data access: `mssql`, no Prisma
Prisma 7.10.1 with `@prisma/adapter-mssql` was tried in a separate throwaway project against `FirstSteps_Dev`:

| Scenario | Result |
|---|---|
| Create / update on `Journey_Tasks` (two triggers) | Worked; the trigger filled `CompletedAt` |
| Completing a task with an open prerequisite | Trigger error returned (51001 only inside the message text) |
| Create on `Help_Requests` (one trigger) | Worked |
| Stored procedure with OUTPUT parameter via `$queryRaw` | Worked |
| `db pull` with the least-privilege login | 8 models and 10 FKs correct, **DEFAULT constraints missing** |

Prisma is compatible, but lost defaults on introspection, error numbers only as text and an extra layer (generated client, config, adapter that itself uses `mssql`) led to using `mssql` directly. Every value is bound as a typed parameter; only module constants (column lists, ORDER BY clauses) are part of SQL text.

### Reuse of the stored procedures
- Registration: `usp_User_Insert` (always creates a Student, returns `SCOPE_IDENTITY`).
- Journey creation: `usp_Journey_CreateWithTasks` (transaction), plus `HomeCountryCode` in the same transaction.
- Status changes: `usp_JourneyTask_UpdateStatus` (leaving Completed clears `CompletedAt`).
- Withdrawing a help request: `usp_HelpRequest_DeleteOpen`.
- Open-task list in the student report: `usp_Journey_PendingTaskCursorReport` (cursor).

### Authentication and authorization
- argon2id (`@node-rs/argon2`); plain passwords are never stored or logged.
- Session: HS256-signed, `HttpOnly`, `SameSite=Lax` cookie, `Secure` in production, 7 days. It contains only `userId`; role and `IsActive` are read from the database on each request, so a deactivated account loses access immediately.
- Every page and server action starts with `requireUser` / `requireRole`. Student queries filter by `UserID`, so another student's record is "not found". Mentors only see requests where `MentorUserID` is their own id and only the student's first name and task context.
- Server actions are protected against CSRF by Next.js origin checks.
- In-memory rate limits: sign-in 5 per 15 min per email, registration 5 per email plus 30 overall per 15 min, password change 5 per 15 min. `X-Forwarded-For` is only used when `TRUST_PROXY=true`.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` disabled.

### Journey engine rules (`src/domain`)
- **Task selection:** active template, global or matching university, programme `All` or matching, accommodation `Any` or matching. Same rule as `usp_Journey_CreateWithTasks`.
- **Locked:** identical to the database trigger: each prerequisite must exist in the same journey with status `Completed`. The lock is computed, not stored.
- **Blocked:** a status the student chooses for an external obstacle; separate from dependency locks.
- **Reopening:** a completed task cannot be reopened while a task depending on it is completed.
- **NotApplicable:** set only by re-planning; students cannot choose it.
- **Re-planning (accommodation change):** newly applicable tasks are added, open tasks that no longer apply become `NotApplicable`, `NotApplicable` tasks that apply again are reopened. No rows are deleted and completed tasks are never changed.
- **Cycle check:** depth-first search when an admin adds a dependency; the cycle path is shown in the error.
- **Missing / NotApplicable prerequisites:** see [issues/001](issues/001-prerequisite-satisfaction.md).

A `THROW` inside a trigger dooms the transaction. `withTransaction` rolls back and the error is translated to a user message (`src/server/errors.ts`).

### Languages (English, Turkish)
- Routes live under `src/app/[locale]/`. `src/proxy.ts` rewrites clean URLs (`/dashboard`) to the locale from the `fs_locale` cookie (default English); a prefixed URL such as `/tr/dashboard` sets the cookie. Server components read the locale with `next/root-params`, server actions from the cookie.
- Interface text comes from typed dictionaries (`src/i18n/messages/en.ts`, `tr.ts`); a missing or extra key is a type error and the unit tests check placeholders. Validation and server errors carry message keys and are translated where they are shown. Dates and numbers use `Intl`.
- Content (task and source texts) comes from the database: English in the course tables, Turkish in the translation tables, with English fallback and a notice ([database.md](database.md#content-translations-0002_content_translationssql)).
- Admin task pages in Turkish still show the English source title and the stored category codes, because those are what admins edit.

### Next.js 16 notes
- `cacheComponents` is enabled (it becomes the default in the next major version). The shell is static; user-dependent navigation and header parts render in their own `<Suspense>` boundaries and pages render behind `loading.tsx`.
- `mssql` is listed in `serverExternalPackages`; bundling it pulls in `@azure/identity` → `open`, which breaks the build.
- In development the Next.js overlay shows an "instant navigation" insight for pages that read the session. It is a performance hint, not a functional error.
- On streamed pages `notFound()` responds with HTTP 200 and renders "Page not found"; no data is rendered.
- Metadata is streamed too: `<title>` is filled a few milliseconds after the first HTML (12–80 ms measured warm).

## Out of scope for the MVP
Real-time chat, email verification and password reset, a persistent audit trail, languages beyond English and Turkish, document upload, payments.
