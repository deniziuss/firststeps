import { beforeEach, describe, expect, it } from "vitest";
import { countEvent, observeDb, renderMetrics, resetMetrics } from "@/server/metrics";

describe("metrics", () => {
  beforeEach(() => resetMetrics());

  it("counts log events and database durations in the Prometheus text format", () => {
    countEvent("warn", "auth", "sign_in_failed");
    countEvent("warn", "auth", "sign_in_failed");
    observeDb(3, true);
    observeDb(120, true);
    observeDb(800, false);
    const text = renderMetrics({ size: 4, available: 3, borrowed: 1, pending: 0 });
    expect(text).toContain('firststeps_log_events_total{level="warn",category="auth",event="sign_in_failed"} 2');
    expect(text).toContain('firststeps_db_statement_duration_ms_bucket{le="5"} 1');
    expect(text).toContain('firststeps_db_statement_duration_ms_bucket{le="500"} 2');
    expect(text).toContain('firststeps_db_statement_duration_ms_bucket{le="+Inf"} 3');
    expect(text).toContain("firststeps_db_statement_failures_total 1");
    expect(text).toContain('firststeps_db_pool_connections{state="in_use"} 1');
    expect(text).toMatch(/firststeps_process_uptime_seconds \d+/);
  });

  it("ignores labels that are not plain identifiers (no injection into the output)", () => {
    countEvent("warn", "auth", 'x"} 999\nfake_metric 1');
    expect(renderMetrics(undefined)).not.toContain("fake_metric");
  });
});
