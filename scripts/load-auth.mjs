// Concurrent sign-in and registration through the real app (production build, local test database).
// Synthetic qa+load-… accounts only; they are removed afterwards by the normal cleanup.
//   phase 1: 20 registrations at the same time
//   phase 2: 40 sign-ins at the same time (20 correct, 20 with a wrong password, different accounts)
// Reports per-request latency (median / p95 / max) and any unexpected outcome.
// Usage: node scripts/load-auth.mjs http://localhost:3700
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3700";
const browser = await chromium.launch({ channel: "msedge" });
const stamp = Date.now();
const password = `Load-${stamp}-pass`;
const summary = (label, samples, failures) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  console.log(`${label.padEnd(36)} n=${samples.length} median ${at(0.5).toFixed(0)} ms  p95 ${at(0.95).toFixed(0)} ms  max ${sorted.at(-1).toFixed(0)} ms  unexpected ${failures}`);
  if (failures) process.exitCode = 1;
};

async function pagesFor(count) {
  return Promise.all(
    Array.from({ length: count }, async () => {
      const context = await browser.newContext({ baseURL: base });
      await context.addCookies([{ name: "fs_locale", value: "en", url: `${base}/` }]);
      return context.newPage();
    }),
  );
}

// Phase 1: registrations
const regPages = await pagesFor(20);
await Promise.all(regPages.map((page) => page.goto("/register", { waitUntil: "networkidle" })));
const emails = regPages.map((_, i) => `qa+load-${i}-${stamp}@example.invalid`);
await Promise.all(
  regPages.map(async (page, i) => {
    await page.getByLabel("First name").fill("Load");
    await page.getByLabel("Last name").fill(`User ${i}`);
    await page.getByLabel("Email").fill(emails[i]);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
  }),
);
let failures = 0;
const regTimes = await Promise.all(
  regPages.map(async (page) => {
    const started = performance.now();
    await page.getByRole("button", { name: "Create account" }).click();
    try {
      await page.waitForURL(/\/onboarding$/, { timeout: 30_000 });
    } catch {
      failures++;
    }
    return performance.now() - started;
  }),
);
summary("concurrent registration (20)", regTimes, failures);

// Phase 2: sign-ins
const signPages = await pagesFor(40);
await Promise.all(signPages.map((page) => page.goto("/sign-in", { waitUntil: "networkidle" })));
await Promise.all(
  signPages.map(async (page, i) => {
    await page.getByLabel("Email").fill(emails[i % 20]);
    await page.getByLabel("Password").fill(i < 20 ? password : "wrong-password-123");
  }),
);
failures = 0;
const signTimes = await Promise.all(
  signPages.map(async (page, i) => {
    const started = performance.now();
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      if (i < 20) await page.waitForURL(/\/(dashboard|onboarding)$/, { timeout: 30_000 });
      else await page.getByText("Email or password is incorrect.").waitFor({ timeout: 30_000 });
    } catch {
      failures++;
    }
    return performance.now() - started;
  }),
);
summary("concurrent sign-in (20 ok + 20 wrong)", signTimes, failures);
await browser.close();
