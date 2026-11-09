// Local reproduction probe: signs in with the seeded admin account from .env.local and requests
// edge-case URLs, printing only status codes and whether a generic error page was returned.
// Usage: node --env-file=.env.local scripts/probe.mjs [baseUrl] path...
import { chromium } from "@playwright/test";

const [base = "http://localhost:3100", ...paths] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ baseURL: base });
await page.goto("/sign-in", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill(process.env.DEV_ADMIN_EMAIL ?? "");
await page.getByLabel("Password").fill(process.env.DEV_ADMIN_PASSWORD ?? "");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/admin/);
for (const path of paths) {
  const response = await page.goto(path, { waitUntil: "networkidle" });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 120);
  console.log(`${response?.status()}  ${path}  ::  ${text}`);
}
await browser.close();
