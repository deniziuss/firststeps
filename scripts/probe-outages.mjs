// Outage probe for the account flows (local test database only).
//   mode "mail": server started with MAIL_TRANSPORT=disabled. Registration must still work, "resend" must
//                say the email could not be sent, "forgot password" must give its generic answer.
//   mode "db":   server started with DB_PORT=1 (database unreachable, nothing is contacted). Sign-in,
//                registration and "forgot password" must show a translated message, not a crash.
// Usage: node scripts/probe-outages.mjs <mail|db> <baseUrl>
import { chromium } from "@playwright/test";

const [mode, base] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ baseURL: base });
const main = async () => (await page.locator("main").last().innerText()).replace(/\s+/g, " ");
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  :: ${detail}`}`);
  if (!ok) process.exitCode = 1;
};
const email = `qa+outage-${Date.now()}@example.invalid`;
const password = `Outage-${Date.now()}-pass`;

async function register() {
  await page.goto("/register", { waitUntil: "networkidle" });
  await page.getByLabel("First name").fill("Otto");
  await page.getByLabel("Last name").fill("Outage");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForTimeout(4000);
}

async function forgot() {
  await page.goto("/forgot-password", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.waitForTimeout(4000);
  return main();
}

if (mode === "mail") {
  await register();
  check("registration works without email delivery", page.url().endsWith("/onboarding"), page.url());
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Send the link again" }).click();
  await page.waitForTimeout(3000);
  check("resend reports that the email could not be sent", (await main()).includes("The email could not be sent"), await main());
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/sign-in/);
  check("forgot password keeps its generic answer", (await forgot()).includes("If an account exists for this address"), await main());
} else {
  await page.goto("/sign-in", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(5000);
  check("sign-in shows a translated error", (await main()).includes("Something went wrong. Please try again."), await main());
  await register();
  check("registration shows a translated error and keeps the form", (await main()).includes("Something went wrong. Please try again.") && (await page.getByLabel("Email").inputValue()) === email, await main());
  check("forgot password keeps its generic answer", (await forgot()).includes("If an account exists for this address"), await main());
}
await browser.close();
