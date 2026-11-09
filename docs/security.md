# Security and stabilization review (2026-11-09)

Branch `fix/stabilization-security-hardening`, based on `feat/presentation-editorial-motion` (`a461957`).

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
| SEC-01b | Medium | Sessions | same | The revocation list is in memory: lost on restart, not shared by several instances | No session state in the database | Proposal `database/proposals/0004_session_version.sql` (`Users.SessionVersion`) | — | Requires approval |
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
| BR-01 | — | Business rules | Issue 001 / proposal 0003 | See below | — | — | `04_verify.sql` 10/10, `0003_test_rolled_back.sql` 5/5, unit 36 | Requires approval |

## Business rule recommendation (Issue 001)

There are three different cases:
1. **Applies but missing from the journey** (data gap). Blocks; the student repairs it with *Update my plan*. Already implemented.
2. **Genuinely does not apply** (no row and the template does not match the profile, or a `NotApplicable` row). Should count as satisfied.
3. **Exists but is incomplete.** Blocks.

Recommended rule: apply proposal 0003 and the matching change in `unmetPrerequisites`. The rolled-back test passes all cases. It was **not applied**, because changing the trigger needs approval.

## Readiness assessment

**Ready now (controlled local presentation):**
- Student, mentor and admin workflows are exercised end to end in English and Turkish.
- Authentication: argon2id, generic errors, rate limits.
- Sessions: revoked on sign-out, invalidated by password change, 24 h lifetime.
- Server-side role and ownership checks on every action and page, with negative tests.
- Parameterized SQL, plus database constraints and triggers.
- CSP and security headers; http(s)-only links.
- axe-clean pages, responsive layouts, reduced-motion support.

**Needs attention before any public deployment:**
- Persistent session revocation (proposal 0004).
- A shared rate-limit store and a trusted client IP.
- HTTPS termination.
- Email verification and password reset.
- Admin audit trail.
- Backups and monitoring.
- Real, reviewed content: every source is still *Review pending*.
- A decision on proposal 0003.
- A manual screen-reader pass.
- A nonce-based CSP.
- Database tests in CI with a disposable SQL Server container.

**Future improvements:** see the roadmap in the README. They are out of scope for this branch.

Automated tests passing does not make the application production-ready; the list above stands.
