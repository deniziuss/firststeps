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

## Security infrastructure (proposal 0006, measured on FirstSteps_Test, 2026-11-09)
| Operation | Measurement |
|---|---|
| `usp_RateLimit_Hit`, new key / same key (200 sequential calls through the app login and pool) | median 1.41 / 1.13 ms, p95 2.16 / 1.59 ms |
| `usp_RateLimit_Peek` | median 0.67 ms, p95 1.08 ms |
| 100 parallel hits on one key | 76 ms in total; final count exactly 100 (no lost increment) |
| Token issue + consume | median 2.05 ms, p95 2.56 ms |
| Session lookup on every request (now also reads SessionVersion and EmailVerifiedAt) | median 0.67 ms, p95 1.21 ms |
| 20 simultaneous registrations through the app | median 967 ms, p95 1.10 s, 0 failures |
| 40 simultaneous sign-ins (20 correct, 20 wrong) | median 1.34 s, p95 1.59 s, 0 failures |

**Breakdown** (`scripts/perf-breakdown.mjs`, 2026-11-10):

| Component | Alone | 40 at the same time |
|---|---|---|
| Argon2id hash (m=19 MiB, t=2, p=1) | median 10.5 ms, p95 13.4 ms | — |
| Argon2id verify | median 10.4 ms, p95 16.0 ms | median 96 ms, p95 168 ms; all 40 done after 171 ms (libuv thread pool of 4) |
| SQL Server execution of the dashboard's journey query (`sys.dm_exec_query_stats`) | 0.12 ms per execution, max 1.6 ms | — |
| Same query, client time (pool of 10) | median 1.1 ms | median 51.7 ms → about **50 ms waiting for a pooled connection** (the first burst also opens new connections) |
| Rate-limit hit, token, session lookup | 0.7–2 ms each (table above) | 100 parallel hits on one key: 76 ms in total |

**Reading the numbers**
- In the 40-sign-in burst through the app (median 1.34 s), argon2id explains at most about 0.17 s, SQL execution well under 0.01 s, and pool waiting about 0.05 s.
- The rest, roughly 1.1 s, is outside the database and the password hash. Next.js rendering and running 40 browser tabs on the same machine as the server are the likely causes, but **that part was not measured separately**. An earlier version of this page wrongly said that argon2id dominated.
- The 18 `slow_query` warnings (606–647 ms) during the burst came from 20 dashboards opened at the same moment. The statements themselves take about 0.1 ms on the server, so the time was spent waiting (connection pool and an overloaded Node process), not executing.
- At pilot size this is acceptable. Before a public deployment, measure with a load tool on separate client and server machines, and size the pool and `UV_THREADPOOL_SIZE` from that.

Scripts:
- `scripts/perf-db.mjs`: database latency.
- `scripts/load-auth.mjs`: concurrent auth through the app.
- `scripts/verify-0006-security.mjs`: races and permissions.

## Not measured
- Concurrent load, cold-start behaviour of the database after `AUTO_CLOSE` (it is off in setup), and real mobile hardware.
