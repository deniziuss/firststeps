# Security and stabilization review

Rounds:
1. Branch `fix/stabilization-security-hardening` (PR #3), based on `feat/presentation-editorial-motion` (`a461957`): SEC-01 … FUN-04.
2. Branch `fix/comprehensive-security-performance`: SEC-18 … DB-01, the pending schema changes and the production-readiness checklist (see the sections below).

**Framework:** OWASP ASVS 5.0, the parts that fit this application:
- V2 validation
- V3 web frontend
- V4 API
- V6 authentication
- V7 session management
- V8 authorization
- V13 configuration
- V14 data protection

**Scope:** testing ran only against the local `FirstSteps_Dev` instance. The school server was not contacted.

Status labels: **Fixed and verified**, **Verified, no issue found**, **Open issue**, **Requires approval**, **Not tested**.

## Findings register

| ID | Severity | Area | Where | Evidence | Root cause | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|---|
| SEC-01 | High | Sessions | `src/server/session.ts`, `actions/auth.ts` | Copying the `fs_session` cookie before sign-out still gave access after sign-out (stateless JWT, 7-day expiry) | Sign-out only deleted the cookie in the browser | Each token has a `jti`; sign-out revokes it on the server (in-process list until expiry). Lifetime reduced to 24 h | `security.spec.ts` › "revoked on sign-out" | Fixed and verified (single process; see SEC-01b) |
| SEC-01b | Medium | Sessions | same | The revocation list is in memory: lost on restart, not shared by several instances | No session state in the database | Migration 0004 (`Users.SessionVersion`), applied 2026-11-09 after approval; see round 3 | `security.spec.ts` (sign-out, every device), `scripts/test-session-restart.mjs` | Fixed and verified |
| SEC-02 | High | Sessions | `dal.ts`, `actions/auth.ts` | After a password change, a session on another device stayed valid | Token held only the user id | Token holds `pv`, an HMAC of the stored password hash; `getCurrentUser` rejects mismatches. The current browser receives a fresh session | `security.spec.ts` › "changing the password signs out other sessions" | Fixed and verified |
| SEC-03 | Medium | Output / links | `lib/validation.ts`, source and university links | `z.url()` accepted `javascript:alert(1)` and `data:` URLs (unit check). React 19 blocks `javascript:` hrefs at render time, so no script ran | Validation allowed any scheme | Only `http`/`https` accepted; every database link is rendered through `safeHref()` | Unit (`action-guards.test.ts`), E2E › "cannot store javascript: or data: links" | Fixed and verified |
| SEC-04 | Medium | Headers | `next.config.ts` | No CSP, HSTS or COOP header | Not configured | Added CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`), HSTS in production, COOP `same-origin` | E2E › "security headers"; all E2E and axe suites pass with the policy | Fixed and verified |
| SEC-05 | Low | CSP strength | `next.config.ts` | `script-src` still needs `'unsafe-inline'` (Next.js inline payload, theme bootstrap) | A nonce would make every page dynamic (cacheComponents) | Documented; React escaping and the checks below remain the main XSS defence | — | Open issue |
| SEC-06 | Medium | Abuse | `server/rateLimit.ts`, `actions/auth.ts` | Limits are per process and in memory. Without a trusted proxy, all clients share one IP key, so 5 wrong attempts lock an email for 15 min (lock-out of a known address) | Single-process design | Map shared through `globalThis`, pruned. Needs a shared store and a real client IP behind a proxy before public deployment | Existing E2E (wrong password) | Open issue |
| SEC-07 | Low | Authorization | `actions/student.ts` › `setJourneyStatus` | Submitting another student's `journeyId` returned "Journey status saved." The update was scoped to the owner, so nothing changed | Affected-row count ignored | Returns "Journey not found." when 0 rows change | E2E › "cannot change another student's journey or task by tampering" (rewrites the Server Action request) | Fixed and verified |
| SEC-08 | — | Authorization | All server actions | Each action starts with `requireRole`/`requireUser`; repositories filter by owner (`UserID`) or assigned mentor | — | Static guard test added so a new action cannot skip the check | `action-guards.test.ts` (25 actions), `roles.spec.ts`, `security.spec.ts` | Verified, no issue found |
| SEC-09 | — | Session tokens | `session.ts` | Unsigned (`alg: none`), wrongly signed and malformed cookies | — | `jwtVerify` with HS256 only and required `exp`/`iat`/`jti` claims | E2E › "forged and tampered session cookies are rejected" | Verified, no issue found |
| SEC-10 | — | XSS | Help requests, all views | `<img onerror>`, `<b>` and `<script>` in subject and description | — | React escaping; no `dangerouslySetInnerHTML` except the constant theme/JS flag scripts | E2E › "HTML typed into a help request is shown as text" | Verified, no issue found |
| SEC-11 | — | SQL injection | `server/repositories/*` | Every query is parameterized (`request.input`); no string-built SQL with user input | — | LIKE wildcards in the admin user search are now escaped (`escapeLike`) | `admin/users` search | Verified, no issue found |
| SEC-12 | — | Passwords | `server/password.ts` | argon2id (`@node-rs/argon2` defaults); 10–128 character limit; same message for unknown email, wrong password and inactive account | — | — | `student-journey.spec.ts` | Verified, no issue found |
| SEC-13 | — | CSRF | Server Actions | Next.js compares `Origin` with `Host` for every action; session cookie `SameSite=Lax`, `HttpOnly`, `Secure` in production | — | — | — | Verified, no issue found (framework control) |
| SEC-14 | Low | Dependencies | `package-lock.json` | `npm audit --omit=dev`: 0. Full audit: 13 low/moderate in dev tooling only (`eslint-config-next` → typescript-eslint → minimatch; `shadcn` CLI → deepmerge) | Upstream | Not shipped to users; the offered "fixes" are major downgrades. CI now fails on high/critical production advisories | CI step | Open issue (dev tooling, accepted) |
| SEC-15 | Low | CI | `.github/workflows/ci.yml` | `contents: read` already | — | `persist-credentials: false`, production audit step. Actions are pinned by tag, not by commit SHA | — | Fixed and verified (SHA pinning: open) |
| SEC-16 | — | Secrets | repository, history | `.env.local` is git-ignored; the diff has no secret values (scanned against `.env.local`) | — | — | Manual scan | Verified, no issue found |
| SEC-17 | Low | Account | Users | No email verification, password reset or "sign out everywhere" | Out of MVP scope | Needs an email service | — | Open issue |
| REL-01 | Low | Database | `server/db.ts` | No explicit timeouts; a deadlock victim (1205) surfaced as a generic error | Defaults | 15 s connection/request timeouts; a transaction that lost a deadlock is retried once (it was fully rolled back) | Typecheck; not reproducible on demand | Fixed (deadlock retry not exercised by a test) |
| FUN-01 | Medium | Report | `journey/[journeyId]/report/page.tsx` | Open tasks waiting for a prerequisite were listed as "To do" | The cursor procedure returns raw status | Same "Locked" rule as the journey page | `student-journey.spec.ts` (report row shows "Locked") | Fixed and verified |
| FUN-02 | Low | Admin users | `admin/users/page.tsx`, `repositories/users.ts` | Unpaged list of all accounts | — | 50 per page with counts, previous/next links, empty message | Accessibility suite covers the page | Fixed and verified |
| FUN-03 | Low | Admin users | `actions/admin.ts` › `saveUser` | An unknown user id reported "saved" | Affected rows ignored | "User not found." | Typecheck | Fixed |
| FUN-04 | Low | Titles | mentor request and admin template pages | Generic browser titles | — | Title names the request/template, using the same authorization as the page | Manual | Fixed |
| BR-01 | — | Business rules | Issue 001 / proposal 0003 | See below | — | Migration 0003, applied 2026-11-09 after approval | `prerequisite-parity.test.ts`, `prerequisite-rule.spec.ts` | Fixed and verified |

## Round 2 findings (branch `fix/comprehensive-security-performance`)

| ID | Severity | Area | Where | Evidence | Root cause | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|---|
| SEC-18 | Medium | Abuse | `actions/auth.ts` › `clientKey` | With `TRUST_PROXY=true` the **first** `X-Forwarded-For` entry was used. The client controls that entry, so changing it per request bypasses every rate limit | Proxy chain read from the wrong end | `server/client-ip.ts` reads the entry added by the trusted proxy (`TRUST_PROXY_HOPS` from the right) and accepts only IP-shaped values | `client-ip.test.ts` | Fixed and verified |
| FUN-05 | Medium | Routing | Detail pages, `/admin/users?page=`, action ids | `/admin/templates/99999999999`, `/mentor/requests/99999999999` and `/admin/users?page=99999999999` showed the framework error page (probe on the production build): the id overflowed the SQL `INT` parameter | `Number()` accepted values outside the INT range | `lib/ids.ts` `parseId()` on every route id (1 … 2,147,483,647, digits only); action schemas cap ids; page numbers are capped | `security.spec.ts` › "out-of-range and malformed ids" | Fixed and verified |
| REL-02 | Medium | Errors | `src/app` | No error boundary: an unexpected server error (for example the database unreachable) showed an untranslated framework page | Missing `error.tsx` | Translated error boundaries for public, auth and app routes (focus moves to the heading, the reference digest is shown, never the stack) and a bilingual `global-error.tsx` | Probe with `DB_PORT=1` (`scripts/probe-db-down.mjs`) showed "Bu sayfa yüklenemedi … Referans: …" | Fixed and verified |
| REL-03 | Low | Errors | `actions/auth.ts` | With the database down, sign-in replaced the whole page with the error view | Unhandled driver error in the action | Sign-in and registration return the generic translated message inside the form, which keeps its values | Probe | Fixed |
| LOG-01 | Low | Logging | `server/errors.ts` | Unexpected errors were logged as whole objects | — | `server/log.ts` writes one JSON line with the error name, code, SQL error number and a shortened message; email addresses are masked; no stack, request body, token or connection string | Typecheck | Fixed |
| SEC-19 | — | Passwords | `server/password.ts` | All stored hashes are `$argon2id$v=19$m=19456,t=2,p=1` (OWASP minimum) | Parameters came from library defaults | Parameters are now explicit, so a library update cannot weaken them | Existing sign-in tests | Fixed and verified |
| SEC-15b | Low | CI | `ci.yml` | Actions referenced by moving tags | — | Pinned to commit SHAs (`checkout` and `setup-node` v4.4.0) | CI run | Fixed and verified |
| DEP-01 | — | Dependencies | `package.json` | `npm audit --omit=dev`: 0. Newer patches exist: react 19.3.1 ("improve RSC transport"), jose 6.2.16 and gsap 3.15.1 (the last two less than two weeks old) | — | No upgrade. The App Router runs the React build vendored by Next.js 16.4.5 (the latest release), so the `react` package version does not change the server runtime | — | Verified, no issue found |
| SEC-20 | — | CSP | `next.config.ts` | A nonce-based CSP requires dynamic rendering of every page, which removes Partial Prerendering | Framework constraint | Kept the current policy with `'unsafe-inline'`; documented | — | Open issue (SEC-05) |
| PERF-01 | — | Performance | All pages | TTFB 4–5 ms, load 43–63 ms on signed-in pages; landing LCP 232/384 ms | — | No change needed ([performance.md](performance.md)) | `scripts/perf*.mjs` | Verified, no issue found |
| DB-01 | Low | Indexes | `Help_Requests.JourneyTaskID`, `Task_Dependencies.RequiredTaskID`, `Journey_Tasks.TaskID` | Foreign keys without an index (not measurable at pilot size) | — | Proposal 0005 | — | Requires approval |
| BR-01 | Medium | Business rules | Trigger and `unmetPrerequisites` / `checkTransition` | A dependency whose prerequisite applies to fewer students than the dependent task locked it permanently for the others. This happened after an admin added such a dependency (the form warned about it) or after a housing change marked the prerequisite *Not needed*. **Correction:** an earlier version of this register said the seed data already contained such a case (task 16 → task 1). That was wrong: task 16 itself applies only to Erasmus students, so it never reaches a student without task 1 | Strict trigger rule | Migration 0003 plus application changes (round 3) | `prerequisite-rule.spec.ts`, parity tests | Fixed and verified |
| SEC-01b | Medium | Sessions | `session.ts` | Sign-out revocation lived in process memory | — | Migration 0004 plus application changes (round 3) | Restart test | Fixed and verified |

## Round 3: migrations 0003 and 0004 (approved and applied, 2026-11-09)

**Applied only to the local `FirstSteps_Dev`** (`DenizSQLEXPRESS`), after a verified copy-only backup. The backup was made with `scripts/db/backup-dev.ps1` and checked with `RESTORE VERIFYONLY`; the file is in the instance backup folder, outside the repository. The school server was not contacted.

| Step | Result |
|---|---|
| `0003_prerequisite_applicability.sql` | Applied; the live trigger checks template applicability |
| `0004_session_version.sql` | Applied; `SessionVersion` added with `DF_Users_SessionVersion` and `CK_Users_SessionVersion`; existing rows set to 0, no other values changed |
| `04_verify.sql` | 12/12 PASS (two new migration checks) |
| Rollback rehearsal (`database/rollbacks/rehearse_rollback.sql`): roll back 0004 and 0003, re-apply both, all in one transaction that is then rolled back | PASS. It also found that `0003` lacked a final `GO`, so the next script run in the same `sqlcmd` session would have become part of the trigger body. The live trigger was checked (clean), and the file is fixed |
| SQL ↔ TypeScript parity (`npm run test:db`): 9 cases (completed; NotApplicable row; absent because of housing, programme or an inactive template; applicable but absent; Pending, InProgress or Blocked) | Trigger and engine agree on all 9 |

**Application changes:**
- **0003:**
  - `unmetPrerequisites` treats NotApplicable and genuinely irrelevant prerequisites as satisfied.
  - `checkTransition` receives the journey applicability.
  - The "not part of your plan" message and alert are removed.
  - The admin gap warning now says the prerequisite is skipped for those students.
- **0004:**
  - Tokens carry `sv`.
  - Sign-out, a password change and an admin role or status change increment the version atomically. An unchanged admin save does not.
  - The in-memory revocation list is removed; the password fingerprint `pv` is kept as a second check.
  - **Sign-out ends the sessions on every device of the account.**

**Tests:**
- `security.spec.ts`: sign-out on one device signs out the others; an admin role or status change ends sessions; existing session tests.
- `prerequisite-rule.spec.ts`: never-added prerequisite; housing change.
- `scripts/test-session-restart.mjs`: a revoked cookie is rejected after a restart, and a later session survives it.

## Round 4: security infrastructure (branch `feat/security-infrastructure-readiness`)

All new tables are in **proposal 0006** (`database/proposals/0006_security_infrastructure.sql`, rollback `database/rollbacks/0006_rollback.sql`).
- **Tested on:** `FirstSteps_Test`, a restored copy of a verified `FirstSteps_Dev` backup, and in the CI SQL Server container.
- **Not applied** to `FirstSteps_Dev`: **Prepared, awaiting approval**.
- The application code on this branch needs 0006, so until it is approved the branch runs against `FirstSteps_Test` (`DB_NAME=FirstSteps_Test`).

| ID | Area | Before | Now | Evidence | Status |
|---|---|---|---|---|---|
| SEC-06 / SEC-01 follow-up | Rate limiting | In process memory: lost on restart, separate per instance, unbounded per key | SQL Server buckets (`dbo.Rate_Limit_Buckets`, `usp_RateLimit_Hit` with UPDLOCK + HOLDLOCK). Keys are HMACs, so no email or IP is stored. Expired rows are purged. Only failed sign-ins count, in three buckets (see below) | `account-security.spec.ts` (limit, unaffected neighbour), `0006_verify.sql` (window, peek, purge), `test-session-restart.mjs` (limit survives a restart) | Implemented and verified |
| SEC-17a | Email verification | None | Hashed single-use tokens, POST confirmation, resend limit; help requests need a verified address (server-side) | `account-security.spec.ts` test 1, TR flow in `i18n.spec.ts` | Implemented and verified |
| SEC-17b | Password reset | None | Generic answer, 30-minute single-use link, `SessionVersion` + 1 ends every session, links built from `APP_URL` | `account-security.spec.ts` test 2 | Implemented and verified |
| SEC-21 | Admin audit trail | None | `dbo.Admin_Audit_Events`, written in the **same transaction** as each change. UPDATE is refused (51020); DELETE only via `usp_AdminAudit_Purge`, which keeps at least 365 days (51021–51023). Read-only, filterable and paged admin page | `account-security.spec.ts` test 4, `0006_verify.sql` | Implemented and verified |
| OPS-01 | Health | None | `/api/health` and `/api/ready` (no details) | `account-security.spec.ts` test 5, CI readiness step | Implemented and verified |
| OPS-02 | Logging | Unstructured errors only | Categorised JSON lines with `requestId`, redaction, slow-query warning, DB connection failure, auth and admin events | Unit-level review; lines observed in the E2E server output | Implemented but not fully tested (no automated assertion on log content) |
| OPS-03 | Configuration | Local checks only | `DEPLOYMENT=public` refuses http `APP_URL`, the mail outbox, an unencrypted or unvalidated DB connection, and a missing trusted proxy | `env.test.ts` | Implemented and verified |
| OPS-04 | Backup and restore | Backup with VERIFYONLY | Plus status file, retention for a dedicated folder, restore test into a separate database with `CHECKDB` and count comparison | Run 2026-11-09 | Implemented and verified (schedule awaiting approval) |
| FUN-06 | Forms | **Correction to REL-03 (round 2):** the claim that sign-in and registration "keep their values" on a database error was not verified, and it was false. React 19 resets a form after every submission, so registration cleared all fields (found by `probe-outages.mjs`) | Failed actions echo non-secret fields (`keptValues`) and `Field` re-creates the input with them; passwords are never echoed | `account-security.spec.ts` › "a failed registration keeps what the student typed", outage probe | Implemented and verified |
| A11Y-01 | Tables on phones | Admin tables that scroll sideways on a 360 px screen could not be scrolled with the keyboard (axe `scrollable-region-focusable`, found by the new phone tests) | The table container is focusable and shows a focus ring | `account-screens.spec.ts` | Implemented and verified |
| CI-01 | Database tests in CI | None | Disposable SQL Server 2022 container per run (generated, masked passwords): migrations, seeds, `04_verify`, `0006_verify`, SQL/TS parity, app readiness with the least-privilege login | CI run on the PR | See test results |

**Rate-limit policy** (`src/server/authLimits.ts`):

| Operation | Buckets |
|---|---|
| Sign-in (failures only) | client+account 5 / 15 min; client 30 / 15 min; account 50 / hour |
| Registration | address 3 / hour; client 10 / hour |
| Reset request | address 3 / hour; client 10 / hour |
| Reset submit | client 20 / 15 min |
| Verification resend | account 3 / hour |
| Password change | account 5 / 15 min |

- **Client buckets** exist only behind a trusted proxy (`TRUST_PROXY=true`, required when `DEPLOYMENT=public`).
- **Lock-out of a known address:** one client can only block its own client+account pair. Blocking the account for everyone takes 50 failures from at least 10 different addresses within an hour.
- **Without a proxy** (local use), the pair acts per account. This is the remaining part of SEC-06: **Open issue for any deployment without a trusted proxy**, which public mode refuses.

**Audit coverage:**
- user role/status changes;
- university create/update;
- task create/update/translation;
- prerequisite add/remove;
- source add/status/delete;
- mentor assignment.

Details hold ids, enum values and content titles only; keys that look like emails, passwords, tokens or sessions are dropped. Students and mentors are redirected away from `/admin/audit`.

## Round 5: operational readiness (branch `feat/operational-readiness-hardening`)

| ID | Area | Finding or change | Evidence | Status |
|---|---|---|---|---|
| OPS-01 | Migration 0006 | **Bug:** the email-verification backfill ran again on any database where no account was verified yet, so a re-run could verify unconfirmed accounts. Now it runs only in the transaction that creates the column | `0006_rerun_unverified.sql`: old 6 wrongly verified, fixed 0; `0006_idempotency.sql` 9/9 PASS locally and in CI | Fixed (not applied to Dev) |
| OPS-02 | Host header / HTTPS | With `DEPLOYMENT=public`, unknown `Host` → 421, `X-Forwarded-Proto: http` → 308 to `APP_URL`. My first version echoed the request path and allowed `//evil.example` (open redirect); found by its own unit test and fixed | `tests/unit/deployment.test.ts` (6) | Implemented and verified; needs a host |
| OPS-03 | Reverse proxy | Caddy and nginx configs: TLS, overwritten forwarding headers, limits, timeouts, metrics hidden | `deploy/` | Prepared |
| OPS-04 | Email | SMTP with mandatory TLS 1.2+, certificate checks, timeouts, retry of temporary failures only; no recipient or link in logs; `SMTP_REQUIRE_TLS=false` refused in public mode | `tests/unit/mail.test.ts` (6, local fake SMTP) | Implemented; needs a provider |
| OPS-05 | Metrics | `/api/metrics` behind `METRICS_TOKEN` (404 when unset, 401 for a wrong token, constant-time comparison). The build had prerendered it as a static 404; fixed with `connection()` | Unit, E2E and CI | Implemented and verified |
| OPS-06 | Data export | `/api/account/export`: own data only, no hashes or session data, 10 per hour, 401 without a session | E2E, CI | Implemented and verified |
| OPS-07 | Anonymisation | Students only, dry run first, double confirmation, active admin required, audited, idempotent, extra guard for Dev | Run on `FirstSteps_Test` | Implemented and verified |
| OPS-08 | CI | The 0006 security script, maintenance and the 0005 measurement run with the least-privilege app login or inside rolled-back transactions; owner passwords reach `sqlcmd` only through `SQLCMDPASSWORD` | `.github/workflows/ci.yml` | Implemented |

## Proposals still pending

| File | Change | Data impact | Rollback |
|---|---|---|---|
| `database/proposals/0006_security_infrastructure.sql` | Rate limits, tokens, audit, `EmailVerifiedAt` (corrected backfill) | New tables; existing accounts marked verified once | `database/rollbacks/0006_rollback.sql` (deletes tokens and audit history: manual only) |
| `database/proposals/0005_foreign_key_indexes.sql` | One index, `Help_Requests (JourneyTaskID)` (measured; see `docs/database.md`) | None | `DROP INDEX IX_HelpRequests_JourneyTask ON dbo.Help_Requests` |
## Pending schema changes (round 2 plan, kept for reference)

| File | Change | Data impact | Rollback |
|---|---|---|---|
| `database/migrations/0003_prerequisite_applicability.sql` (applied) | Prerequisite trigger: Completed, NotApplicable and genuinely irrelevant prerequisites count as satisfied | None (affects future completions only) | `database/rollbacks/0003_rollback.sql` |
| `database/migrations/0004_session_version.sql` (applied) | `Users.SessionVersion INT NOT NULL DEFAULT 0`, check `>= 0` | No values change; every user signs in once again after deployment | `database/rollbacks/0004_rollback.sql` |
| `database/proposals/0005_foreign_key_indexes.sql` | Three foreign-key indexes | None | Drop the three indexes |

**Before applying:**
1. Run `powershell -File scripts/db/backup-dev.ps1`. It makes a copy-only backup of `FirstSteps_Dev` and verifies it with `RESTORE VERIFYONLY`.
2. Apply the SQL to the local `FirstSteps_Dev` only.
3. Deploy the matching application code:
   - 0003: `checkTransition` and `unmetPrerequisites`, and remove the "not part of your plan" text.
   - 0004: add the `sv` claim; increment it on sign-out, password change and admin role/status change; remove the in-memory list.
4. Run the parity, verification and E2E tests.

## Business rule recommendation (Issue 001)

There are three different cases:
1. **Applies but missing from the journey** (data gap). Blocks; the student repairs it with *Update my plan*. Already implemented.
2. **Genuinely does not apply** (no row and the template does not match the profile, or a `NotApplicable` row). Should count as satisfied.
3. **Exists but is incomplete.** Blocks.

Implemented: migration 0003 and the matching application rule, approved and applied on 2026-11-09 (round 3).

## Readiness assessment (2026-11-10)

This assessment does not claim that the application is secure or production-ready. It lists what has evidence.

**Implemented and verified**
- **Workflows and access control:** student, mentor and admin workflows end to end in English and Turkish. Server-side role and ownership checks with negative tests; parameterized SQL; constraints and triggers.
- **Authentication and sessions:** Argon2id, generic errors, persistent SQL rate limits with race tests. Sessions revoked on sign-out, password change and admin changes (`SessionVersion`).
- **Account security:** email verification and password reset with single-use hashed tokens; append-only admin audit log that the app login cannot alter. All of this on `FirstSteps_Test` and in CI.
- **Migration 0006:** idempotent and safe to re-run (corrected).
- **Headers and pages:** CSP and security headers; axe-clean pages; responsive layouts; reduced motion.
- **Operations:**
  - verified backups with a free-space check;
  - restore test with a schema comparison against Dev;
  - health and readiness endpoints, a token-protected metrics endpoint, a local health/alert check and log rotation;
  - bounded maintenance.
- **Privacy:** self-service data export; audited anonymisation.
- **CI:** a disposable SQL Server with migrations, re-runs, 0006 scenarios, parity, security checks with the app login, maintenance and readiness.

**Implemented but requires configuration**
- **HTTPS:** host and Proto checks (`DEPLOYMENT=public`, `APP_URL`, `TRUST_PROXY`).
- **Email:** SMTP delivery (`MAIL_TRANSPORT=smtp`, provider credentials, SPF/DKIM/DMARC).
- **Metrics:** `METRICS_TOKEN`.
- **Backups:** a dedicated backup folder with restricted permissions.

**Prepared, awaiting approval**
- Migration 0006 on `FirstSteps_Dev`, after a backup.
- Proposal 0005 (one index).
- Windows scheduled tasks: backup, restore test, health check.
- Reverse-proxy configs and a host.
- An email provider.
- The privacy notice (draft; owner must confirm contact, legal basis and retention).

**Still missing**
- Real, reviewed content: every source is still *Review pending*.
- A nonce-based CSP (evaluated, not adopted).
- A hosted SQL Server: the app accepts only a local server by project rule.
- An external alerting channel: alerts are written locally only.

**Not tested**
- A manual screen-reader pass.
- The proxy configs on real Caddy or nginx.
- Real SMTP delivery and inbox placement.
- Backup retention on a real dedicated folder.
- The scheduled tasks themselves.
- Load from a separate client machine.

### Verdict
| Use | Ready? |
|---|---|
| Local demonstration | **Yes** (with 0006 applied to `FirstSteps_Dev` after approval; the branch code needs it) |
| Controlled pilot (one instance, known users) | **After** approval and setup of: 0006 on the pilot database, an HTTPS host with the prepared proxy, an email provider, scheduled backups and health checks, and the confirmed privacy notice |
| Public deployment | **No.** In addition: reviewed content, a hosted database decision, external alerting and a load test from separate machines |

Automated tests passing does not make the application production-ready; the lists above stand.