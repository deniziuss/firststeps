# Testing

| Layer | Command | Where it runs |
|---|---|---|
| TypeScript | `npm run typecheck` | Local and CI |
| Lint | `npm run lint` | Local and CI |
| Unit (Vitest) | `npm test` | Local and CI |
| Production build | `npm run build` | Local and CI |
| End-to-end (Playwright, Microsoft Edge, production build on port 3100) | `npm run test:e2e` | Local only (needs the database) |
| Database behaviour | `npm run db:local:setup` (`04_verify.sql`) | Local only |
| Accessibility (axe-core, WCAG 2.2 AA rules) | part of `npm run test:e2e` | Local only |
| Test data cleanup rules | `npm run db:cleanup-test-data -- --self-test` | Local only |
| Dependency audit | `npm audit --omit=dev` | Local |

End-to-end tests sign in with the synthetic admin and mentor accounts from `.env.local` (`npm run db:seed-users`).

## Test isolation
- Every test gets its own browser context with an English `fs_locale` cookie (auto fixture in `tests/e2e/fixtures.ts`). Tests that need Turkish set it themselves with `useLocale`; checks in another language or as another user run in a separate context, so no test depends on the order of the others.
- Cookies are set host-only (`url`), like the cookie the app sets, so the two never coexist with different values.
- Progress checks are exact: the expected "1 of N" is computed from the applicable tasks visible on the journey page, not matched with a loose pattern.
- A test that creates an active task template deactivates it in `finally` from its own admin session, so a failure cannot change the task lists of later tests.
- Tests that need data from another role create it themselves (for example the mentor accessibility test creates and assigns its own help request).

## Test data cleanup
Every E2E run removes the synthetic records it created (`tests/e2e/global-setup.ts` → `scripts/db/cleanup-test-data.mjs --apply --since=<run start>`). Set `E2E_KEEP_DATA=1` to keep them for debugging.

Safety rules of the cleanup:
- Local `FirstSteps_Dev` only. The script refuses any other server or database, and re-checks the connected database.
- Dry run by default; `--apply` commits. Everything runs in one transaction.
- **Users:** removed only when every condition holds:
  - the email starts with `e2e+`, `sweep+`, `qa+` or `title+`;
  - the email ends with `@example.invalid` (a reserved domain that cannot belong to a real person);
  - the role is `Student`;
  - with `--since`, the account was created after that time.
  Admin and Mentor accounts and the seeded accounts never match. Their journeys, journey tasks and help requests are removed with them.
- **Templates:** removed only when the title is `E2E … <13-digit timestamp>`, the template is inactive, and no remaining journey uses it.
- No `TRUNCATE` and no schema change.
- `--self-test` checks the rules on decoys in a rolled-back transaction: wrong domain, missing prefix, prefix not at the start, Mentor role, and accounts older than `--since`.

## Alpha v0.0.1 results (2026-11-08)
| Check | Result |
|---|---|
| Typecheck, lint, build | Pass |
| Unit | 36/36 (rule engine, dependency graph, progress, i18n key parity and placeholders) |
| End-to-end | 19/19, two consecutive runs |
| Database verification | 10/10 PASS |
| axe-core | No violations on public, student, admin and mentor pages (including a mentor request page), in English and Turkish, light and dark |
| Cleanup self-test | Pass: 1 matching account removed, 4 decoys and all older accounts kept |
| Screen sweep (all pages, en/tr, light/dark, 360 px and 1280 px) | No other-language text, raw message keys, horizontal overflow or empty titles; intentional English on admin task pages (English source title, stored category codes) |

## Editorial redesign checks (2026-11-09)
| Check | Result |
|---|---|
| Landing E2E (`landing.spec.ts`) | Dependency demo follows the prerequisite and reopening rules and saves nothing; section links scroll and mark the active section; mobile menu; no overflow at 360 px; reduced motion leaves nothing hidden |
| axe-core on the landing page | Audited after all animations settle and again with reduced motion, English and Turkish, light and dark |
| Responsive sweep (`scripts/screenshots.mjs`) | 360, 390, 768, 1024, 1280, 1440, 1920 px × en/tr × light/dark: no horizontal overflow |
| Design captures (`CAPTURE=1 npx playwright test visual`) | Student, mentor, admin and auth screens; skipped in normal runs |
| Performance (`scripts/perf.mjs`) | See [design-system.md](design-system.md#5-performance) |

## Stabilization and security checks (2026-11-09)
| Check | Result |
|---|---|
| Unit | 64/64, including server-action guard checks and URL safety |
| End-to-end | 32/32 in two consecutive full runs; 2 opt-in screenshot tests skipped |
| `security.spec.ts` | Sign-out revocation, password-change invalidation, forged cookies, tampered Server Action requests (cross-student), HTML injection, unsafe link schemes, security headers |
| Database | `04_verify.sql` 10/10 PASS; proposal 0003 rolled-back test 5/5 PASS |
| Responsive sweep | 360, 390, 768, 1024, 1280, 1920 px × public pages × en/tr × light/dark: no overflow |
| Dependency audit | `npm audit --omit=dev`: 0 vulnerabilities |

Round 2 (`fix/comprehensive-security-performance`): unit 67/67 (adds trusted-proxy parsing); E2E 33/33 in two consecutive full runs, with a new test that out-of-range and malformed ids are "not found". Database outage behaviour: `scripts/probe-db-down.mjs` against a server with `DB_PORT=1` (the database is not contacted).

Findings and their status: [security.md](security.md).

## Document title
On dynamic pages Next.js streams metadata, so `<title>` is filled shortly after the first HTML. Measured on the production build: 12–80 ms when warm. Longer gaps only appeared on a cold database (see [database.md](database.md#local-sql-server-express-settings)). The accessibility test waits for the title before running axe.

Latest results are recorded in [progress.md](progress.md).

## Acceptance criteria coverage

| ID | Covered by |
|---|---|
| A01 Registration | E2E: registration, duplicate email rejected; argon2id hash format checked in the database |
| A02 Sign in / out | E2E: sign in and out, wrong password, protected pages redirect to sign-in |
| A03 Role isolation | E2E: student B sees "Page not found" for student A's journey, task and report pages, and none of A's data |
| A04 Journey creation | E2E (Erasmus + not arranged gets the right tasks) and unit tests (`journeyEngine`) |
| A05 Duplicate prevention | Database: UNIQUE(JourneyID, TaskID); E2E: second journey for the same university and date rejected |
| A06 / A07 Dependencies | E2E (the server refuses even when the disabled option is forced; allowed after the prerequisite), unit tests, database 51001 |
| A08 Reopening | E2E (CompletedAt cleared; prerequisite cannot be reopened while a dependent is completed) and database |
| A09 Source display | E2E ("Review pending" status shown) |
| A10 Help request | E2E on the student's own task; the ownership check for other students' tasks is in the repository code, without a dedicated E2E test |
| A11 Mentor authorization | E2E (a Mentor is assigned); database 51002 (a Student cannot be assigned) |
| A12 Mentor privacy | E2E (a request is not visible to the mentor before assignment) |
| A13 Admin editing | E2E (a new template appears in a new journey; students cannot open admin pages) |
| A14 Dashboard | E2E smoke test; figures come from database queries and `summarizeProgress` is unit tested |
| A15 Cycles | E2E (rejected with the cycle path) and unit tests |
| A16 Re-planning | E2E (1 added, 1 no longer needed, completed task kept), E2E repair of a prerequisite added after the journey (Issue 001), unit tests |
| A17 Report | E2E (open task list from the cursor procedure) |
| A18 Local only | Configuration: the app and scripts refuse a non-local `DB_SERVER` or a `DB_NAME` other than `FirstSteps_Dev` |

## Notes
- Next.js 16 keeps recently visited pages mounted but hidden, so E2E tests only target visible elements.
- The Next.js route announcer also has `role="alert"`; tests select form messages with `data-slot="alert"`.
