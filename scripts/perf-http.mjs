// HTTP time without a browser, to separate server work (HTTP + rendering) from browser/test-client
// overhead in scripts/load-auth.mjs. Plain fetch from Node against a running production build.
//   1. GET /sign-in (prerendered shell): 30 sequential requests, then 40 at the same time
//   2. GET /api/ready (one database round trip, no rendering): 30 sequential, then 40 at the same time
// Reports time to first byte and full response per request (median / p95 / max).
// Usage: node scripts/perf-http.mjs http://localhost:3700
const base = process.argv[2] ?? "http://localhost:3700";
const at = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const report = (label, samples) => {
  const ttfb = samples.map((s) => s.ttfb).sort((a, b) => a - b);
  const total = samples.map((s) => s.total).sort((a, b) => a - b);
  const bad = samples.filter((s) => !s.ok).length;
  console.log(
    `${label.padEnd(30)} n=${samples.length}  TTFB median ${at(ttfb, 0.5).toFixed(1)} p95 ${at(ttfb, 0.95).toFixed(1)}  ` +
      `total median ${at(total, 0.5).toFixed(1)} p95 ${at(total, 0.95).toFixed(1)} max ${total.at(-1).toFixed(1)} ms  failed ${bad}`,
  );
  if (bad) process.exitCode = 1;
};
async function once(path) {
  const start = performance.now();
  const response = await fetch(base + path, { headers: { Cookie: "fs_locale=en" }, redirect: "manual" });
  const ttfb = performance.now() - start;
  await response.arrayBuffer();
  return { ttfb, total: performance.now() - start, ok: response.status === 200 };
}
for (const path of ["/sign-in", "/api/ready"]) {
  for (let i = 0; i < 5; i++) await once(path); // warm-up
  const sequential = [];
  for (let i = 0; i < 30; i++) sequential.push(await once(path));
  report(`${path} sequential`, sequential);
  report(`${path} 40 concurrent`, await Promise.all(Array.from({ length: 40 }, () => once(path))));
}
