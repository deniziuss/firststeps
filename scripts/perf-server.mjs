// Server response timing for signed-in pages of a running production build (local lab numbers).
// Signs in as the seeded admin and as a new synthetic student (qa+perf-…@example.invalid, removed by
// `npm run db:cleanup-test-data -- --apply`). For each page: median time to first byte and to the
// load event over N warm requests, and the number of SQL round trips is not measured here.
// Usage: node --env-file=.env.local scripts/perf-server.mjs [baseUrl] [runs]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const runs = Number(process.argv[3] ?? 8);
const browser = await chromium.launch({ channel: "msedge" });
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function measure(page, paths, label) {
  for (const path of paths) {
    await page.goto(path, { waitUntil: "load" }); // warm-up
    const ttfb = [];
    const load = [];
    for (let i = 0; i < runs; i++) {
      await page.goto(path, { waitUntil: "load" });
      const nav = await page.evaluate(() => {
        const [entry] = performance.getEntriesByType("navigation");
        return { ttfb: entry.responseStart - entry.requestStart, load: entry.loadEventEnd - entry.startTime };
      });
      ttfb.push(nav.ttfb);
      load.push(nav.load);
    }
    console.log(`${label.padEnd(8)} ${path.padEnd(28)} TTFB ${median(ttfb).toFixed(0).padStart(4)} ms   load ${median(load).toFixed(0).padStart(5)} ms`);
  }
}

const admin = await browser.newPage({ baseURL: base });
await admin.goto("/sign-in", { waitUntil: "networkidle" });
await admin.getByLabel("Email").fill(process.env.DEV_ADMIN_EMAIL ?? "");
await admin.getByLabel("Password").fill(process.env.DEV_ADMIN_PASSWORD ?? "");
await admin.getByRole("button", { name: "Sign in" }).click();
await admin.waitForURL(/\/admin/);
await measure(admin, ["/admin", "/admin/users", "/admin/requests", "/admin/templates", "/admin/reports"], "admin");

const student = await browser.newPage({ baseURL: base });
await student.goto("/register", { waitUntil: "networkidle" });
const password = `Perf-${Date.now()}-pass`;
await student.getByLabel("First name").fill("Perf");
await student.getByLabel("Last name").fill("Probe");
await student.getByLabel("Email").fill(`qa+perf-${Date.now()}@example.invalid`);
await student.getByLabel("Password", { exact: true }).fill(password);
await student.getByLabel("Confirm password").fill(password);
await student.getByRole("button", { name: "Create account" }).click();
await student.waitForURL(/\/onboarding$/);
await student.waitForLoadState("networkidle");
await student.getByLabel("When do you arrive?").fill("2027-02-01");
await student.getByRole("button", { name: "Create my plan" }).click();
await student.waitForURL(/\/journey\/\d+$/);
const journeyPath = new URL(student.url()).pathname;
const taskPath = await student.locator('main a[href^="/tasks/"]').first().getAttribute("href");
await measure(student, ["/dashboard", journeyPath, taskPath, `${journeyPath}/report`, "/help", "/essentials"], "student");
await browser.close();
