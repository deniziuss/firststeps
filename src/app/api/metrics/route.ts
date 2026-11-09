import { createHash, timingSafeEqual } from "node:crypto";
import { poolStats } from "@/server/db";
import { env } from "@/server/env";
import { renderMetrics } from "@/server/metrics";

// Prometheus-format metrics for a local scraper or scripts/ops/health-check.ps1.
// Disabled (404) unless METRICS_TOKEN is set; then `Authorization: Bearer <METRICS_TOKEN>` is required.
// The reverse-proxy configs in deploy/ do not forward /api/metrics, so it stays reachable only from the
// host itself.
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function GET(request: Request) {
  const token = env().METRICS_TOKEN;
  if (!token) return new Response(null, { status: 404 });
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!timingSafeEqual(digest(given), digest(token))) {
    return new Response(null, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  return new Response(renderMetrics(await poolStats()), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
