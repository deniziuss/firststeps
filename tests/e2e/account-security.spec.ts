import type { Page } from "@playwright/test";
import { BASE_URL, expect, test } from "./fixtures";
import { adminCredentials, button, createJourney, formAlert, formStatus, latestMail, PASSWORD, ready, register, signIn, signOut, uniqueEmail, verifyEmail } from "./helpers";

// Migration 0006: email verification, password reset, persistent rate limits and the admin audit log.
// Synthetic accounts in the local test database only; emails go to the development outbox.

// Submits the sign-in form once and returns the message of THIS attempt (waits for the action to finish;
// React resets the form after each submission).
async function wrongSignIn(page: Page, email: string, password = "definitely-wrong-password") {
  const field = (label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
  await field("Email").fill(email);
  await field("Password").fill(password);
  await button(page, "Sign in").click();
  await expect(button(page, "Sign in")).toBeEnabled();
  await page.waitForLoadState("networkidle");
  await expect(formAlert(page)).toBeVisible();
  return (await formAlert(page).innerText()).trim();
}

test("a new student must confirm the email address before asking a mentor; the link works once", async ({ page }) => {
  const email = uniqueEmail("verify");
  await register(page, "Vera", email, { verify: false });
  await createJourney(page, { arrival: "2027-10-01" });

  // Unverified: banner on the dashboard, no help form on tasks.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Confirm your email address" })).toBeVisible();
  await page.locator('main a[href^="/tasks/"]').filter({ visible: true }).first().click();
  await ready(page);
  await expect(page.getByText(/Confirm your email address before asking a mentor/)).toBeVisible();
  await expect(button(page, "Ask a mentor")).toHaveCount(0);

  // Resending issues a new link; the first link stops working.
  const first = await latestMail(email, "/verify-email/");
  await page.goto("/dashboard");
  await ready(page);
  await button(page, "Send the link again").click();
  await expect(page.getByText("A new confirmation link is on its way.")).toBeVisible();
  await expect.poll(async () => (await latestMail(email, "/verify-email/")).link).not.toBe(first.link);
  await page.goto(new URL(first.link).pathname);
  await ready(page);
  await button(page, "Confirm my email address").click();
  await expect(formAlert(page)).toContainText("invalid, has expired or was already used");

  await verifyEmail(page, email);
  // Used once: confirming again with the same link fails.
  const used = await latestMail(email, "/verify-email/");
  await page.goto(new URL(used.link).pathname);
  await ready(page);
  await button(page, "Confirm my email address").click();
  await expect(formAlert(page)).toContainText("invalid, has expired or was already used");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Confirm your email address" })).toHaveCount(0);
  await page.locator('main a[href^="/tasks/"]').filter({ visible: true }).first().click();
  await ready(page);
  await expect(button(page, "Ask a mentor")).toBeVisible();
});

test("password reset: generic answer, single-use link, every session ends", async ({ page, browser }) => {
  const email = uniqueEmail("reset");
  await register(page, "Remy", email);
  const other = await browser.newContext({ baseURL: BASE_URL });
  await other.addCookies([{ name: "fs_locale", value: "en", url: `${BASE_URL}/` }]);
  const otherPage = await other.newPage();
  await signIn(otherPage, email, PASSWORD);
  await signOut(page);

  // The same answer for a known and an unknown address (no account discovery).
  const answers: string[] = [];
  for (const address of [email, uniqueEmail("nobody")]) {
    await page.goto("/forgot-password");
    await ready(page);
    await page.getByLabel("Email").fill(address);
    await button(page, "Send reset link").click();
    await expect(formStatus(page)).toBeVisible();
    answers.push(await formStatus(page).innerText());
  }
  expect(answers[0]).toBe(answers[1]);

  const { link, subject } = await latestMail(email, "/reset-password/");
  expect(subject).toBe("Reset your FirstSteps password");
  const resetPath = new URL(link).pathname;
  await page.goto(resetPath);
  await ready(page);
  const newPassword = `${PASSWORD}-reset`;
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await button(page, "Save new password").click();
  await expect(page).toHaveURL(/\/sign-in\?reset=1$/);
  await expect(page.getByText("Your password was changed.")).toBeVisible();

  // The other device was signed out; the old password no longer works; the new one does.
  await otherPage.goto("/dashboard");
  await expect(otherPage).toHaveURL(/\/sign-in$/);
  await page.goto("/sign-in");
  await ready(page);
  expect(await wrongSignIn(page, email, PASSWORD)).toContain("Email or password is incorrect.");
  await signIn(page, email, newPassword);

  // The link cannot be used a second time.
  await signOut(page);
  await page.goto(resetPath);
  await expect(page.getByText("This link is invalid, has expired or was already used.")).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  // A made-up token is rejected the same way.
  await page.goto(`/reset-password/${"A".repeat(43)}`);
  await expect(page.getByText("This link is invalid, has expired or was already used.")).toBeVisible();
  await other.close();
});

test("failed sign-ins are limited per account and client; the limit is stored in the database", async ({ page }) => {
  const email = uniqueEmail("limit");
  await register(page, "Lena", email);
  await signOut(page);
  await page.goto("/sign-in");
  await ready(page);
  for (let i = 0; i < 5; i++) expect(await wrongSignIn(page, email)).toContain("Email or password is incorrect.");
  // Sixth attempt: blocked, even with the correct password (no oracle for the right password).
  expect(await wrongSignIn(page, email)).toContain("Too many attempts");
  expect(await wrongSignIn(page, email, PASSWORD)).toContain("Too many attempts");

  // Another account from the same place is not affected.
  const neighbour = uniqueEmail("limit-other");
  await register(page, "Nils", neighbour);
  await signOut(page);
  await signIn(page, neighbour, PASSWORD);
});

test("admin changes are written to the audit log; students cannot open it", async ({ page, browser }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  const email = uniqueEmail("audit");
  await register(page, "Aud", email);

  const adminContext = await browser.newContext({ baseURL: BASE_URL });
  await adminContext.addCookies([{ name: "fs_locale", value: "en", url: `${BASE_URL}/` }]);
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin.email, admin.password);
  await adminPage.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await ready(adminPage);
  const row = adminPage.getByRole("row").filter({ hasText: email });
  // Deactivating keeps the account a Student, so the normal test-data cleanup removes it afterwards.
  await row.getByRole("checkbox", { name: "Active" }).uncheck();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("User updated.")).toBeVisible();

  await adminPage.goto("/admin/audit?action=user_update");
  await ready(adminPage);
  const newest = adminPage.locator('tr[data-audit-action="user_update"]').first();
  await expect(newest).toContainText("User role or access changed");
  await expect(newest).toContainText('"active":false');
  // Details never contain the user's email address.
  await expect(adminPage.locator("main")).not.toContainText(email);
  await adminContext.close();

  // The student (now signed out by the deactivation) and other students cannot reach the page.
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/sign-in$/);
  await register(page, "Stu", uniqueEmail("audit-student"));
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("health endpoints answer without details, and every response has a request id", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  const ready = await request.get("/api/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ready" });
  const page = await request.get("/sign-in");
  expect(page.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
});

test("a failed registration keeps what the student typed (except passwords)", async ({ page }) => {
  await page.goto("/register");
  await ready(page);
  await page.getByLabel("First name").fill("Ümran");
  await page.getByLabel("Last name").fill("Çelik");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(`${PASSWORD}-different`);
  await button(page, "Create account").click();
  await expect(formAlert(page).first()).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Ümran");
  await expect(page.getByLabel("Last name")).toHaveValue("Çelik");
  await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});
