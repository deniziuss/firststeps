# Development progress

Last updated: 2026-11-08

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 1 Foundation | Done | Local SQL Server 2022 Express; `FirstSteps_Dev` from `0001_initial_schema.sql`; database verification 10/10; `mssql` data access layer; Prisma compatibility trial and decision |
| 2 Authentication & onboarding | Done | Registration (argon2id, insert procedure), sign in/out, sessions, role routing, rate limits, profile and password, onboarding |
| 3 Journey engine | Done | Personal task generation (transaction procedure), stages, prerequisite locks, status changes, reopen rule, re-planning, progress |
| 4 Guidance & assistance | Done | Task guides, sources with review status, I'm stuck, mentor answers, local essentials |
| 5 Administration & analytics | Done | Universities, templates, dependencies (cycle and applicability checks), source review, request assignment, user roles, reports, student progress report |
| 6 Testing & finalization | Done for the MVP | Unit, E2E and database tests; security review; light/dark and mobile checks |
| 7 Version control & CI | Done | Public GitHub repository, GitHub Actions (install, typecheck, lint, unit tests, build) |

## Latest local results (2026-11-08)
Typecheck and lint pass · unit tests 26/26 · production build passes · E2E 7/7 · database verification 10/10 · `npm audit --omit=dev`: 0 vulnerabilities.

## Open items
1. **Prerequisite rule ([issues/001](issues/001-prerequisite-satisfaction.md))**: needs a product decision on missing / not-applicable prerequisites.
2. **Content**: task and source texts are synthetic drafts; all sources are `PendingReview` and need a real review before use.
3. **CI**: database-backed and end-to-end tests are local only until an isolated SQL Server service is set up for CI.
4. **Not yet implemented**: email verification, password reset, audit trail, multilingual content, real-time chat, deployment.

## Working agreement
- `main` stays green: typecheck, lint, unit tests and build pass before every push; database and E2E tests run locally for changes that touch them.
- Larger or risky changes go through a feature branch and a pull request.
- Commit messages use conventional prefixes (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `ci:`).
- This file is updated at the end of every development session.
