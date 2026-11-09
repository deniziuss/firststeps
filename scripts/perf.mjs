// Measures transferred JavaScript, LCP and CLS for a few pages of a running production build.
// Usage: node scripts/perf.mjs [baseUrl]   (default http://localhost:3100). Numbers are local, not field data.
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const pages = ["/en", "/en/sign-in"];
const browser = await chromium.launch({ channel: "msedge" });

for (const [label, viewport, cpu] of [
  ["desktop", { width: 1440, height: 900 }, 1],
  ["mobile (4x CPU slowdown)", { width: 390, height: 844 }, 4],
]) {
  for (const path of pages) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    let js = 0;
    page.on("response", async (res) => {
      if (res.request().resourceType() === "script") {
        const size = Number(res.headers()["content-length"] ?? (await res.body().catch(() => Buffer.alloc(0))).length);
        js += size;
      }
    });
    await page.addInitScript(() => {
      window.__lcp = 0;
      window.__cls = 0;
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = Math.max(window.__lcp, e.renderTime || e.loadTime || e.startTime)))).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000); // LCP stops at the first input, so let the first view settle before scrolling.
    for (let y = 0; y < 9000; y += 700) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1500);
    const { lcp, cls } = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
    console.log(`${label.padEnd(26)} ${path.padEnd(12)} JS ${(js / 1024).toFixed(0)} KB (decoded)  LCP ${lcp.toFixed(0)} ms  CLS ${cls.toFixed(3)}`);
    await context.close();
  }
}
await browser.close();
