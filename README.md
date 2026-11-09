# FirstSteps

**English** | [Türkçe](README.tr.md)

A personalized onboarding and relocation platform for international students.

FirstSteps turns the arrival process of an international student into a personal, ordered plan: which tasks apply to them, what has to happen first, where the official information is, and who can help when they get stuck. The first pilot scope is Erasmus and international students arriving in Liepāja, Latvia.

> **Status:** alpha (v0.0.1 in review), developed and tested locally against Microsoft SQL Server. It is a student project and is not deployed. It is not affiliated with or endorsed by any university, and its guidance is informational, not legal advice.

## The problem

Students moving abroad collect information about housing, university registration, residence formalities, transport, health insurance and daily life from many disconnected sources. It is often unclear which steps apply to their situation, in which order they must be done, whether the information is still current, and where to ask when something goes wrong.

## Features

Implemented and covered by tests (see [docs/testing.md](docs/testing.md)):

- **Accounts and roles:** student self-registration, sign in and out, Student / Mentor / Admin roles, profile and password change. Passwords are hashed with argon2id; every page and server action checks the role and ownership on the server.
- **Smart journey builder:** a student creates a journey (university, arrival date, programme, accommodation). Matching task templates become personal tasks, grouped into Before arrival, First days, First week and Settling in.
- **Task dependency engine:** tasks can require other tasks. Locked tasks explain what they are waiting for, a completed task cannot be reopened while a dependent task is completed, and admins cannot create dependency cycles. A prerequisite that does not apply to the student (other programme or housing status, or *Not needed* after a plan change) never locks a task; the database trigger and the application follow the same rule.
- **Plan updates:** when the accommodation status changes, the journey is re-planned: new tasks are added, tasks that no longer apply are marked *Not applicable*, and completed work is never lost.
- **Verified information:** tasks link to official sources that show their review status (*Verified*, *Review pending*, *Outdated*) and the date of the last check.
- **I'm stuck / Buddy Connect:** students open a help request on a task; an admin assigns it to a mentor, who sees only the requests assigned to them and answers asynchronously.
- **Local essentials:** a city and university guide built from the practical task content and its sources.
- **Dashboards and reports:** student progress by stage, a printable progress report, a mentor queue, and an admin overview with anonymous aggregate charts.
- **Admin panel:** universities, task templates, dependencies (with cycle and applicability checks), source review, help request assignment and user roles.
- **English and Turkish:** the whole interface, validation messages and dates are available in both languages. The language switch is in the header before and after sign-in and is remembered in a cookie. Task and source texts from the database are translated; when a translation is missing, the English text is shown with a notice.
- **Editorial design and motion:** an editorial landing page (floating navigation, product preview with example data, scroll storytelling, an interactive dependency demo, mentor workflow) and the same visual language on student, mentor and admin screens. Motion uses GSAP, Lenis smooth scrolling on the landing page only, and two adapted React Bits components; it respects reduced-motion settings and content never depends on it. Details: [docs/design-system.md](docs/design-system.md).
- **Security review:** sessions are revoked on sign-out and invalidated by a password change, a Content Security Policy and security headers are sent, and stored links are limited to http(s). Findings, tests and the readiness assessment: [docs/security.md](docs/security.md).
- **Account security:** email verification, password reset through a single-use link, persistent rate limits in SQL Server, and an append-only admin audit log. Health and readiness endpoints, structured logs, verified backups and restore tests. See [docs/email.md](docs/email.md) and [docs/operations.md](docs/operations.md). The tables come from migration 0006, approved and applied to the local development database on 2026-11-10.
- **Operations and privacy:** SMTP delivery with TLS and retry (not connected to a provider), metrics and a local health/alert check, verified backups with restore tests that compare the schema, bounded database maintenance, a personal data export in Settings, and an audited anonymisation script. Prepared, not deployed: reverse-proxy configs and scheduled tasks. See [docs/operations.md](docs/operations.md) and [docs/privacy.md](docs/privacy.md).
- **UI:** a natural palette (deep forest, forest green, warm ivory, ochre gold, warm taupe) with light and dark themes, a responsive layout from 360 px, explicit empty, loading and error states, keyboard access and a skip link. Automated WCAG 2.2 AA checks (axe-core) pass on the public, student, mentor and admin screens in both languages and themes.

## Tech stack

| Area | Technology |
|---|---|
| Web app | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react, Recharts, Inter Tight, Inter and Geist Mono fonts |
| Motion | GSAP 3 (ScrollTrigger, SplitText) with `@gsap/react`, Lenis, adapted React Bits components ([notices](THIRD_PARTY_NOTICES.md)) |
| Languages | English and Turkish: own typed dictionaries, `Intl` formatting, locale routing through the Next.js proxy |
| Validation | Zod |
| Database | Microsoft SQL Server (developed on SQL Server 2022 Express), `mssql` driver |
| Auth | argon2id (`@node-rs/argon2`), signed HTTP-only session cookie (`jose`) |
| Tests | Vitest (unit), Playwright (end-to-end), axe-core (accessibility), SQL verification script |

## Architecture

A single Next.js application (modular monolith):

```
Browser
  │
Next.js App Router — server components and server actions
  │   src/server/dal.ts       session → current user, role and ownership checks
  │   src/lib/validation.ts   input validation (Zod)
  ├── src/domain/             pure business rules: task selection, prerequisites, cycles, re-planning, progress
  └── src/server/repositories parameterized SQL and stored procedure calls
        │
Microsoft SQL Server — 8 tables, PK/FK/UNIQUE/CHECK constraints, 3 triggers, 5 stored procedures,
                       plus 2 translation tables (migration 0002)
```

The application checks the rules first to give clear messages; the database enforces them again with constraints and triggers. Details and design decisions: [docs/architecture.md](docs/architecture.md).

## Local development

### Requirements

- Node.js 24 and npm
- Microsoft SQL Server 2016 SP1 or newer; SQL Server 2022 Express works
  - TCP/IP enabled on `127.0.0.1:1433`
  - SQL Server and Windows authentication (mixed mode)
  - Your Windows account must be a sysadmin on the instance (the default for the account that installed it)
- [sqlcmd](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility) (go-sqlcmd)

On Windows, `database/local/configure-sqlexpress.ps1` (run as administrator) enables mixed mode and loopback-only TCP on port 1433 for a `SQLEXPRESS` instance.

### Setup

The alpha version is on the `feat/alpha-0.0.1-ui-i18n` branch:

```bash
git clone -b feat/alpha-0.0.1-ui-i18n https://github.com/deniziuss/firststeps.git
cd firststeps
npm install
npm run db:local:setup
npm run db:seed-users
npm run dev
```

- `db:local:setup` creates the `FirstSteps_Dev` database (with `AUTO_CLOSE` off), a least-privilege application login, applies every file in `database/migrations/` (each is idempotent), loads synthetic pilot content and its Turkish translations, sets the instance's minimum memory (`database/local/05_server_settings.sql`) and runs the verification script. It also creates `.env.local` with generated secrets. It never drops data.
- `db:seed-users` creates one synthetic admin and one synthetic mentor account; their passwords are written only to `.env.local`.
- Open http://localhost:3000 and register a student account.

### Environment variables

See [`.env.example`](.env.example). The app refuses to start its database connection unless `DB_SERVER` is a local address and `DB_NAME` is `FirstSteps_Dev`. Never commit `.env.local`.

| Variable | Purpose |
|---|---|
| `DB_SERVER`, `DB_PORT`, `DB_NAME` | Local SQL Server endpoint and database |
| `DB_USER`, `DB_PASSWORD` | Application login (no DDL rights) |
| `DB_ENCRYPT`, `DB_TRUST_SERVER_CERT` | TLS settings for the local server |
| `SESSION_SECRET` | Signs session cookies (32+ random characters) |
| `TRUST_PROXY` | Use `X-Forwarded-For` for rate limiting only behind a trusted proxy |

## Tests

| Command | What it runs |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests: business rules, translation dictionaries (same keys, placeholders, every key used in code exists) |
| `npm run build` | Production build |
| `npm run test:e2e` | Playwright end-to-end tests against a local production build: student, mentor and admin flows in English and Turkish, language switching, accessibility (needs the local database, seeded users and Microsoft Edge). At the end of a run its own synthetic records are removed; set `E2E_KEEP_DATA=1` to keep them |
| `npm run db:local:setup` | Includes `database/local/04_verify.sql`: object counts and trigger/procedure behaviour, rolled back |
| `npm run test:db` | Prerequisite rule parity: the same cases through the SQL trigger (local `FirstSteps_Dev`, rolled back) and the TypeScript engine |
| `npm run db:cleanup-test-data` | Dry run listing synthetic test records in `FirstSteps_Dev`; `-- --apply` deletes them, `-- --self-test` checks the safety rules (only `e2e+`/`sweep+`… students at `@example.invalid` and inactive `E2E …` templates are ever matched) |

GitHub Actions runs install, typecheck, lint, unit tests and the production build on every push and pull request. Database-backed and end-to-end tests run locally only for now.

## Project structure

```
database/migrations/   schema migrations (0001: tables, indexes, triggers, procedures; 0002: content translations)
database/proposals/    schema changes waiting for a decision (not applied by setup)
database/local/        local setup: database and login, synthetic content, verification, SQL Express configuration
scripts/db/            setup, connection check, schema snapshot, synthetic users, test data cleanup
src/app/[locale]/      routes: (auth) sign-in/register, (app) student, mentor and admin screens
src/i18n/              locale config, English and Turkish dictionaries, translator and formatters
src/proxy.ts           maps clean URLs to the language from the cookie
src/components/        UI components (landing/, motion/, reactbits/, ui/)
src/domain/            business rules (unit tested)
src/server/            environment, database access, session, authorization, repositories, server actions
tests/unit, tests/e2e  Vitest and Playwright tests
docs/                  architecture, database, design system, testing, progress, screenshots
```

## Current status and roadmap

All modules listed above are implemented and tested locally. Current state and open items: [docs/progress.md](docs/progress.md).

Known open points:

- Task and source texts are synthetic drafts; every source is still *Review pending*.

Planned, not yet implemented:

- Email verification and password reset
- Audit trail for admin changes
- Languages beyond English and Turkish
- Additional cities, universities and countries
- Real-time chat between students and mentors
- Calendar and budget planning
- Database integration tests in CI with an isolated SQL Server container
- Deployment

## License

No license has been chosen yet; all rights reserved by the author until one is added.
