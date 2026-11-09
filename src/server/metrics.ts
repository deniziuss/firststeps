/**
 * In-process metrics with negligible overhead (counters and fixed histogram buckets, no timers, no
 * external service). Exposed in the Prometheus text format by GET /api/metrics, which requires
 * METRICS_TOKEN. Values reset when the process restarts; a scraper (or scripts/ops/health-check.ps1)
 * turns them into rates.
 *
 * Collected:
 * - log events by level, category and event name (auth failures, rate limiting, mail failures, errors);
 * - database statement duration (histogram) and failures;
 * - connection-pool size / in use / waiting, process memory and uptime (read at scrape time).
 * HTTP request duration is measured by the reverse proxy (deploy/nginx: $request_time), because the
 * Next.js proxy runs before rendering and cannot see when a response ends.
 *
 * Labels are fixed strings chosen by the code (never user input), so the number of series is bounded.
 */
const DB_BUCKETS_MS = [5, 25, 100, 500, 2000];

type Store = {
  started: number;
  events: Map<string, number>;
  db: { buckets: number[]; count: number; sumMs: number; failures: number };
};

const globalForMetrics = globalThis as unknown as { firstStepsMetrics?: Store };
const store: Store = (globalForMetrics.firstStepsMetrics ??= {
  started: Date.now(),
  events: new Map(),
  db: { buckets: DB_BUCKETS_MS.map(() => 0), count: 0, sumMs: 0, failures: 0 },
});

const LABEL = /^[a-z_]{1,40}$/;

export function countEvent(level: string, category: string, event: string) {
  if (!LABEL.test(level) || !LABEL.test(category) || !LABEL.test(event)) return;
  const key = `${level}|${category}|${event}`;
  if (!store.events.has(key) && store.events.size >= 500) return; // hard bound on series
  store.events.set(key, (store.events.get(key) ?? 0) + 1);
}

export function observeDb(ms: number, ok: boolean) {
  const db = store.db;
  db.count++;
  db.sumMs += ms;
  if (!ok) db.failures++;
  for (let i = 0; i < DB_BUCKETS_MS.length; i++) if (ms <= DB_BUCKETS_MS[i]) db.buckets[i]++;
}

export type PoolStats = { size: number; available: number; borrowed: number; pending: number } | undefined;

export function renderMetrics(pool: PoolStats): string {
  const lines: string[] = [];
  const metric = (name: string, type: string, help: string) => lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);

  metric("firststeps_log_events_total", "counter", "Structured log events by level, category and event.");
  for (const [key, value] of [...store.events].sort()) {
    const [level, category, event] = key.split("|");
    lines.push(`firststeps_log_events_total{level="${level}",category="${category}",event="${event}"} ${value}`);
  }

  const db = store.db;
  metric("firststeps_db_statement_duration_ms", "histogram", "Duration of database statements in milliseconds.");
  DB_BUCKETS_MS.forEach((le, i) => lines.push(`firststeps_db_statement_duration_ms_bucket{le="${le}"} ${db.buckets[i]}`));
  lines.push(`firststeps_db_statement_duration_ms_bucket{le="+Inf"} ${db.count}`);
  lines.push(`firststeps_db_statement_duration_ms_sum ${Math.round(db.sumMs)}`, `firststeps_db_statement_duration_ms_count ${db.count}`);
  metric("firststeps_db_statement_failures_total", "counter", "Database statements that failed.");
  lines.push(`firststeps_db_statement_failures_total ${db.failures}`);

  if (pool) {
    metric("firststeps_db_pool_connections", "gauge", "Connection pool state.");
    lines.push(`firststeps_db_pool_connections{state="open"} ${pool.size}`, `firststeps_db_pool_connections{state="idle"} ${pool.available}`);
    lines.push(`firststeps_db_pool_connections{state="in_use"} ${pool.borrowed}`, `firststeps_db_pool_connections{state="waiting"} ${pool.pending}`);
  }

  const memory = process.memoryUsage();
  metric("firststeps_process_memory_bytes", "gauge", "Process memory.");
  lines.push(`firststeps_process_memory_bytes{type="rss"} ${memory.rss}`, `firststeps_process_memory_bytes{type="heap_used"} ${memory.heapUsed}`);
  metric("firststeps_process_uptime_seconds", "gauge", "Seconds since the metrics store was created.");
  lines.push(`firststeps_process_uptime_seconds ${Math.round((Date.now() - store.started) / 1000)}`);
  return lines.join("\n") + "\n";
}

/** Test helper: clears all counters. */
export function resetMetrics() {
  store.events.clear();
  store.db = { buckets: DB_BUCKETS_MS.map(() => 0), count: 0, sumMs: 0, failures: 0 };
}
