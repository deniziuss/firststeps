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
| Tests | Done | 35 unit, 14 E2E (two consecutive green runs), 10 database checks, axe-core WCAG 2.2 AA in both languages and themes, bilingual screen sweep |

## Results (2026-11-08)
Typecheck, lint and production build pass · unit 35/35 · E2E 14/14 in two consecutive runs · database verification 10/10 · axe-core: no violations on public and student pages (en/tr, light/dark) · screen sweep of every page in en/tr, light/dark, 360 px and 1280 px: no untranslated text, raw keys, overflow or empty titles (admin exceptions below) · `npm audit --omit=dev`: 0 vulnerabilities.

## Open items
1. **Prerequisite rule ([issues/001](issues/001-prerequisite-satisfaction.md))**: product decision on missing / not-applicable prerequisites is still open.
2. **Content**: task and source texts are synthetic drafts; all sources are `PendingReview`. The Turkish translations are drafts too.
3. **Admin in Turkish**: admins edit the English source text, so the English title stays visible under the Turkish one and category codes (`University`, `Housing`, …) are entered as stored.
4. **Accessibility**: automated checks cover admin and mentor screens only through the sweep, not axe; a manual screen reader review has not been done.
5. **CI**: database-backed and end-to-end tests run locally only.
6. **Not yet implemented**: email verification, password reset, audit trail, real-time chat, deployment.

## Working agreement
- `main` stays green: typecheck, lint, unit tests and build pass before every push; database and E2E tests run locally for changes that touch them.
- Larger or risky changes go through a feature branch and a pull request; release tags only after approval.
- Commit messages use conventional prefixes (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `ci:`).
- This file is updated at the end of every development session.
