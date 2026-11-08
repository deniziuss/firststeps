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
| Dependency audit | `npm audit --omit=dev` | Local |

End-to-end tests sign in with the synthetic admin and mentor accounts from `.env.local` (`npm run db:seed-users`).

## Test isolation
- Every test gets its own browser context with an English `fs_locale` cookie (auto fixture in `tests/e2e/fixtures.ts`). Tests that need Turkish set it themselves with `useLocale`; checks in another language or as another user run in a separate context, so no test depends on the order of the others.
- Cookies are set host-only (`url`), like the cookie the app sets, so the two never coexist with different values.
- Progress checks are exact: the expected "1 of N" is computed from the applicable tasks visible on the journey page, not matched with a loose pattern.
- A test that creates an active task template deactivates it in `finally` from its own admin session, so a failure cannot change the task lists of later tests.

## Alpha v0.0.1 results (2026-11-08)
| Check | Result |
|---|---|
| Typecheck, lint, build | Pass |
| Unit | 35/35 (rule engine, dependency graph, progress, i18n key parity and placeholders) |
| End-to-end | 14/14, two consecutive runs |
| Database verification | 10/10 PASS |
| axe-core | No violations: public pages and student pages, English and Turkish, light and dark |
| Screen sweep (all pages, en/tr, light/dark, 360 px and 1280 px) | No other-language text, raw message keys, horizontal overflow or empty titles; intentional English on admin task pages (English source title, stored category codes) |

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
| A16 Re-planning | E2E (1 added, 1 no longer needed, completed task kept) and unit tests |
| A17 Report | E2E (open task list from the cursor procedure) |
| A18 Local only | Configuration: the app and scripts refuse a non-local `DB_SERVER` or a `DB_NAME` other than `FirstSteps_Dev` |

## Notes
- Next.js 16 keeps recently visited pages mounted but hidden, so E2E tests only target visible elements.
- The Next.js route announcer also has `role="alert"`; tests select form messages with `data-slot="alert"`.
