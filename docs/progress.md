# Development progress

Last updated: 2026-11-08

## Releases

| Version | State | Branch |
|---|---|---|
| MVP | Merged to `main` (`663fcdf`) | `main` |
| v0.0.1-alpha | In review (pull request), not tagged | `feat/alpha-0.0.1-ui-i18n` |

## v0.0.1-alpha: UX, design, English/Turkish

| Area | Status | Evidence |
|---|---|---|
| Design system | Done | Palette tokens for light and dark themes in `src/app/globals.css`; contrast measured for every text token (AA on background and card); Fraunces headings, Geist body; restyled buttons, inputs and cards |
| UX | Done | Dashboard built around one "next step"; task page with one primary action per state; status badges with icon, label and description legend; confirmation dialogs for reopen, withdraw and delete; skip link, visible focus, 44 px targets |
| Internationalization | Done | `src/i18n` dictionaries (en, tr) with compile-time key checks; locale routing via `src/proxy.ts` and `next/root-params`; translated validation and server messages; `Intl` dates and numbers |
| Bilingual content | Done | Migration `0002_content_translations.sql` (local only); Turkish seed for 18 tasks and 9 sources; English fallback with a notice; admins edit Turkish titles and descriptions |
| Reliability fix | Done | Local DB: `AUTO_CLOSE OFF` and `min server memory` 512 MB, after concurrent page loads stalled on `RESOURCE_SEMAPHORE` waits (see database.md) |
| Tests | Done | 36 unit, 19 E2E (two consecutive green runs), 10 database checks, axe-core WCAG 2.2 AA on public, student, admin and mentor pages in both languages and themes, bilingual screen sweep |

## v0.0.1-alpha: final quality review (2026-11-08)
| Area | Result |
|---|---|
| Issue 001 | Data gap (an applicable prerequisite missing from the journey) separated from "does not apply"; *Update my plan* repairs the gap (unit and E2E tests). The trigger change for prerequisites that do not apply is a proposal (`database/proposals/0003`), tested in a rolled-back transaction and not applied |
| Accessibility | axe-core now also covers 8 admin pages, the mentor list and a mentor request page, and settings for both roles: en/tr × light/dark, no violations |
| Turkish interface | Runtime scan of every Turkish page, including hidden screen reader text and attributes. Fixed: the mobile menu close button was announced as "Close". Remaining English is content, not interface (see open items) |
| Test data | `npm run db:cleanup-test-data`: dry run by default, test accounts only, rolled-back self-test. Each E2E run removes its own records |
| Screens | Task page: on phones the status and prerequisites now come before the help section, with the status badge under the title. Document title names the task. Admin task page: fields aligned; related tasks shown with Turkish titles in Turkish |

## Results (2026-11-08, after the final review)
Typecheck, lint and production build pass · unit 36/36 · E2E 19/19 in two consecutive runs · database verification 10/10 · axe-core: no violations on public and student pages (en/tr, light/dark) · screen sweep of every page in en/tr, light/dark, 360 px and 1280 px: no untranslated text, raw keys, overflow or empty titles (admin exceptions below) · `npm audit --omit=dev`: 0 vulnerabilities.

## Open items
1. **Prerequisite rule ([issues/001](issues/001-prerequisite-satisfaction.md))**: data gaps are repaired. For prerequisites that do not apply, proposal 0003 waits for a decision; until then such tasks stay locked with an explanation and a help prompt.
2. **Content**: task and source texts are synthetic drafts; all sources are `PendingReview`. The Turkish translations are drafts too.
3. **Admin in Turkish**: admins edit the English source text, so the English title stays visible under the Turkish one and category codes (`University`, `Housing`, …) are entered as stored.
4. **Accessibility**: automated checks only; a manual screen reader and keyboard review of all flows has not been done.
5. **Content shown in English in Turkish**: help request texts written by students, university and person names, URLs, and on admin task pages the English base text that admins edit. These are data, not interface text.
6. **Smaller UX items**: the admin user list has no search or paging; the progress report lists locked tasks as "To do"; mentor and admin detail pages still use generic document titles.
7. **CI**: database-backed and end-to-end tests run locally only.
8. **Not yet implemented**: email verification, password reset, audit trail, real-time chat, deployment.

## Security and stabilization (2026-11-09)
- PR #3 (`fix/stabilization-security-hardening`): session revocation, password-change invalidation, http(s)-only links, CSP and headers, report and admin fixes.
- `fix/comprehensive-security-performance`: trusted-proxy address fix, INT-range id parsing, translated error boundaries, structured logging, explicit argon2id parameters, CI actions pinned by SHA, performance measurements ([performance.md](performance.md)).
- Waiting for approval: proposals 0003 (prerequisite rule), 0004 (persistent sessions) and 0005 (indexes). Findings: [security.md](security.md).

## Security infrastructure (2026-11-09, `feat/security-infrastructure-readiness`)
- **Implemented:**
  - persistent SQL rate limits;
  - email verification and password reset (development outbox);
  - append-only admin audit log with an admin page;
  - health and readiness endpoints, request ids and structured logs;
  - production configuration checks;
  - backup status, retention and restore tests;
  - a CI job with a disposable SQL Server.
- **Waiting for approval:**
  - proposal 0006 for `FirstSteps_Dev`;
  - the Windows backup schedule;
  - a real email provider.

## Operational readiness (2026-11-10, `feat/operational-readiness-hardening`)
- **Fixed:** migration 0006 could mark unverified accounts as verified on a re-run (now tied to the creation of the column; 7 scenarios tested).
- **Implemented:**
  - Host/HTTPS checks for public deployments and prepared Caddy/nginx configs;
  - SMTP transport with TLS, timeouts and retry; branded EN/TR emails;
  - backup free-space check, safe retention and a restore test with a schema comparison;
  - token-protected metrics, a local health/alert check and log rotation;
  - account data export and an audited anonymisation script;
  - bounded maintenance;
  - the 0005 measurement (narrowed to one index);
  - CI coverage for all of it.
- **Waiting for approval:**
  - 0005 on `FirstSteps_Dev` (0006 was approved and applied on 2026-11-10);
  - the scheduled tasks;
  - an email provider;
  - a host and certificates;
  - the privacy notice.

## Working agreement
- `main` stays green: typecheck, lint, unit tests and build pass before every push; database and E2E tests run locally for changes that touch them.
- Larger or risky changes go through a feature branch and a pull request; release tags only after approval.
- Commit messages use conventional prefixes (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `ci:`).
- This file is updated at the end of every development session.
