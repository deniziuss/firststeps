# Performance

All numbers are **local lab measurements**: a production build (`next start`) on the development machine, SQL Server 2022 Express, Microsoft Edge, and pilot-sized data (4 users, 18 active templates, 6 dependencies). They are not field data and do not predict behaviour under load.

## Tools
| Script | Measures |
|---|---|
| `node scripts/perf.mjs [baseUrl]` | Landing and sign-in: decoded JavaScript, LCP, CLS; desktop and mobile with 4× CPU slowdown |
| `node --env-file=.env.local scripts/perf-server.mjs [baseUrl] [runs]` | Signed-in pages (admin and a synthetic `qa+` student): median TTFB and load over N warm requests. The student is removed by `npm run db:cleanup-test-data -- --apply` |
| `node scripts/screenshots.mjs` | Responsive sweep with a horizontal-overflow report |

## Results (2026-11-09)

**Landing and auth (`scripts/perf.mjs`):**

| Page | LCP | CLS | JS (decoded) |
|---|---|---|---|
| Landing, desktop 1440 px | 232 ms | 0.001 | 827 KB |
| Landing, mobile 4× CPU slowdown | 384 ms | 0.000 | 827 KB |
| Sign-in, desktop / mobile | 92 / 284 ms | 0.000 | 885 KB |

Before the hero was rendered with CSS instead of JavaScript (redesign branch), the mobile LCP was 1508 ms.

**Signed-in pages (`scripts/perf-server.mjs`, median of 8 warm requests):**
- TTFB was 4–5 ms on every page. With Partial Prerendering the static frame is served immediately and user data streams in.
- The load event fired after 43–63 ms on admin pages (overview, users, requests, templates, reports) and student pages (dashboard, journey, task, report, help, essentials).

## Decisions
- **No query or rendering optimization was made.** No page showed a measurable bottleneck, and optimizing without one would only add complexity.
- **Session reads are not cached across requests.** `getCurrentUser` runs once per request (React `cache()`) and reads role, active state and password fingerprint from the database every time. This keeps deactivation and revocation immediate. The Next.js development hint about uncached data during navigation is a performance hint, not a defect; the user-dependent parts of the shell already stream inside Suspense boundaries.
- **Motion libraries stay on the landing page.** GSAP, ScrollTrigger, SplitText and Lenis form one chunk (172 KB raw / 62 KB gzip) that only the landing page loads; the authenticated routes do not request it (checked in the build output).
- **Fonts** (Inter, Inter Tight 300–500, Geist Mono) are self-hosted by `next/font` with `latin` + `latin-ext` subsets for Turkish and Latvian characters. The build ships no images besides the favicon.

## Database
- **Index review:** the most frequent filters are covered by existing indexes:
  - journey tasks by `JourneyID` (`UQ_JourneyTasks_JourneyTask`, `IX_JourneyTasks_JourneyStatus`);
  - journeys by `UserID` (`IX_Journeys_User`);
  - mentor queue by `MentorUserID, RequestStatus, CreatedAt` (`IX_HelpRequests_MentorStatus`).

  Execution plans were not captured: at pilot size the optimizer's choices are not representative.
- **Uncovered foreign keys:** three foreign keys have no index:
  - `Help_Requests.JourneyTaskID`
  - `Task_Dependencies.RequiredTaskID`
  - `Journey_Tasks.TaskID`

  At pilot size this cannot be measured. It is a scaling recommendation, prepared as `database/proposals/0005_foreign_key_indexes.sql` and **not applied** (schema change; needs approval).
- **Paging:** the admin user list is paged with `OFFSET … FETCH`, 50 rows per page. The page number is capped, so a large value cannot overflow the SQL `INT` offset.
- **Connection pool and timeouts:** max 10 connections, 15 s connection timeout, 15 s request timeout.
- **Deadlocks:** a transaction chosen as a deadlock victim (1205) has been fully rolled back by SQL Server, so `withTransaction` runs it once more. No other error is retried.

## Not measured
- Concurrent load, cold-start behaviour of the database after `AUTO_CLOSE` (it is off in setup), and real mobile hardware.
