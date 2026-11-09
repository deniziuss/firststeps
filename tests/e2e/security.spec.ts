import type { Browser, Page, Route } from "@playwright/test";
import { BASE_URL, expect, test } from "./fixtures";
import { adminCredentials, button, createJourney, formAlert, PASSWORD, ready, register, signIn, signOut, uniqueEmail } from "./helpers";

// Security regression tests (docs/security.md). They use synthetic accounts in FirstSteps_Dev only.

async function sessionCookie(page: Page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === "fs_session");
  expect(cookie, "signed in").toBeTruthy();
  return cookie!;
}

async function contextWithCookie(browser: Browser, cookie: { name: string; value: string }) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addCookies([
    { name: cookie.name, value: cookie.value, url: `${BASE_URL}/` },
    { name: "fs_locale", value: "en", url: `${BASE_URL}/` },
  ]);
  return context;
}

// Rewrites one field of the next Server Action request, the way a user with devtools or curl could.
async function tamperNextAction(page: Page, field: string, value: number) {
  let done = false;
  const handler = async (route: Route) => {
    const request = route.request();
    if (done || request.method() !== "POST" || !request.headers()["next-action"]) return route.continue();
    done = true;
    const body = request.postDataBuffer()?.toString("latin1") ?? "";
    const tampered = body.replace(new RegExp(String.raw`(name="(?:_?\d+_)?${field}"\r\n\r\n)\d+`), `$1${value}`);
    expect(tampered, "the field was rewritten").not.toBe(body);
    await route.continue({ postData: Buffer.from(tampered, "latin1") });
    await page.unroute("**/*", handler);
  };
  await page.route("**/*", handler);
}

async function expectSignedOut(page: Page) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
}

test("a session token is revoked on sign-out, not only removed from the browser", async ({ page, browser }) => {
  await register(page, "Sam", uniqueEmail("sec-logout"));
  const stolen = await sessionCookie(page);
  await signOut(page);

  const replay = await contextWithCookie(browser, stolen);
  await expectSignedOut(await replay.newPage());
  await replay.close();
});

test("changing the password signs out other sessions and keeps the current one", async ({ page, browser }) => {
  const email = uniqueEmail("sec-password");
  await register(page, "Pia", email);
  const other = await contextWithCookie(browser, await sessionCookie(page));
  const otherPage = await other.newPage();
  await otherPage.goto("/dashboard");
  await expect(otherPage).toHaveURL(/\/dashboard$/);

  await page.goto("/settings");
  await ready(page);
  const newPassword = `${PASSWORD}-new`;
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await button(page, "Change password").click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  // The other device is signed out; this browser still works; the new password signs in.
  await expectSignedOut(otherPage);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await signOut(page);
  await signIn(page, email, newPassword);
  await other.close();
});

test("forged and tampered session cookies are rejected", async ({ browser }) => {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claims = { userId: 1, pv: "x", jti: "x", iat: now, exp: now + 3600 };
  for (const value of [
    `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`, // unsigned token
    `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.${"A".repeat(43)}`, // wrong signature
    "not-a-token",
  ]) {
    const context = await contextWithCookie(browser, { name: "fs_session", value });
    await expectSignedOut(await context.newPage());
    await context.close();
  }
});

test("a student cannot change another student's journey or task by tampering with form values", async ({ page, browser }) => {
  // Student A creates a journey and notes its ids.
  await register(page, "Ana", uniqueEmail("sec-owner"));
  const journeyA = await createJourney(page, { arrival: "2027-03-01" });
  const taskA = Number(
    (await page.locator('main a[href^="/tasks/"]').filter({ visible: true }).first().getAttribute("href"))!.split("/").pop(),
  );

  // Student B submits their own forms with A's ids.
  const contextB = await browser.newContext({ baseURL: BASE_URL });
  await contextB.addCookies([{ name: "fs_locale", value: "en", url: `${BASE_URL}/` }]);
  const pageB = await contextB.newPage();
  await register(pageB, "Ben", uniqueEmail("sec-attacker"));
  const journeyB = await createJourney(pageB, { arrival: "2027-03-02" });

  await ready(pageB);
  await tamperNextAction(pageB, "journeyId", journeyA);
  await pageB.getByRole("combobox", { name: "Journey status" }).selectOption("Cancelled");
  await button(pageB, "Save status").click();
  await expect(formAlert(pageB).filter({ hasText: "Journey not found." })).toBeVisible();

  await pageB.locator('main a[href^="/tasks/"]').filter({ visible: true }).first().click();
  await ready(pageB);
  await tamperNextAction(pageB, "journeyTaskId", taskA);
  await button(pageB, "Mark as done").first().click();
  await expect(formAlert(pageB).filter({ hasText: "Task not found." })).toBeVisible();

  // A's records are unchanged, and B's pages for A's ids are not found.
  await page.goto(`/journey/${journeyA}`);
  await expect(page.getByRole("combobox", { name: "Journey status" })).toHaveValue("Planning");
  await page.goto(`/tasks/${taskA}`);
  await expect(page.getByText("Mark as done").filter({ visible: true }).first()).toBeVisible();
  await pageB.goto(`/journey/${journeyA}`);
  await expect(pageB.getByRole("heading", { name: "Page not found" })).toBeVisible();
  expect(journeyB).not.toBe(journeyA);
  await contextB.close();
});

test("HTML typed into a help request is shown as text, never rendered", async ({ page }) => {
  await register(page, "Hana", uniqueEmail("sec-html"));
  await createJourney(page, { arrival: "2027-04-01" });
  await page.locator('main a[href^="/tasks/"]').filter({ visible: true }).first().click();
  await ready(page);
  const subject = `<img src=x onerror="window.__xss=1"><b>bold</b> ${Date.now()}`;
  await button(page, "Ask a mentor").click();
  await page.getByLabel("Short subject").fill(subject);
  await page.getByLabel("What is the problem?").fill("<script>window.__xss=1</script> please help");
  await button(page, "Send to a mentor").click();
  await expect(page.getByText("Your request was sent")).toBeVisible();

  await page.goto("/help");
  await expect(page.getByText(subject)).toBeVisible();
  expect(await page.locator("main b, main img[src='x'], main script").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("admins cannot store javascript: or data: links as sources", async ({ page }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  await signIn(page, admin.email, admin.password);
  await page.goto("/admin/templates/1");
  await ready(page);
  for (const url of ["javascript:alert(1)", "data:text/html,hi"]) {
    await page.getByLabel("Source title").fill(`Unsafe link ${Date.now()}`);
    await page.getByLabel("Link", { exact: true }).fill(url);
    await button(page, "Add source").click();
    await expect(page.getByText("Enter a full link starting with https://").first()).toBeVisible();
  }
  expect(await page.locator('a[href^="javascript:"], a[href^="data:"]').count()).toBe(0);
});

test("security headers are sent on every page", async ({ request }) => {
  for (const path of ["/", "/sign-in", "/dashboard"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"], path).toContain("object-src 'none'");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["strict-transport-security"], path).toContain("max-age=");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});

test("out-of-range and malformed ids are 'not found', never a server error", async ({ page }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  await signIn(page, admin.email, admin.password);
  for (const path of ["/admin/templates/99999999999", "/admin/templates/1e3", "/admin/templates/0", "/mentor/requests/2147483648"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" }), path).toBeVisible();
  }
  // An overflowing page number falls back to a valid page.
  await page.goto("/admin/users?page=99999999999");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();

  await signOut(page);
  await register(page, "Ida", uniqueEmail("sec-ids"));
  for (const path of ["/tasks/99999999999", "/journey/99999999999", "/journey/99999999999/report", "/tasks/-5"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" }), path).toBeVisible();
  }
});

test("signing out on one device signs the account out on every device (SessionVersion)", async ({ page, browser }) => {
  const email = uniqueEmail("sec-devices");
  await register(page, "Dev", email);
  const laptop = await browser.newContext({ baseURL: BASE_URL });
  await laptop.addCookies([{ name: "fs_locale", value: "en", url: `${BASE_URL}/` }]);
  const laptopPage = await laptop.newPage();
  await signIn(laptopPage, email, PASSWORD);
  await laptopPage.goto("/dashboard");
  await expect(laptopPage).toHaveURL(/\/dashboard$/);

  await signOut(page);
  await expectSignedOut(laptopPage);
  // Signing in again works and issues a token with the new version.
  await signIn(page, email, PASSWORD);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await laptop.close();
});

test("an admin role or status change ends the user's sessions; saving unchanged values does not", async ({ page, browser }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  const email = uniqueEmail("sec-admin-change");
  await register(page, "Rita", email);

  const adminContext = await browser.newContext({ baseURL: BASE_URL });
  await adminContext.addCookies([{ name: "fs_locale", value: "en", url: `${BASE_URL}/` }]);
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin.email, admin.password);
  await adminPage.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await ready(adminPage);
  const row = adminPage.getByRole("row").filter({ hasText: email });

  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("User updated.")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page, "an unchanged save keeps the session").toHaveURL(/\/(dashboard|onboarding)$/);

  await row.getByRole("checkbox", { name: "Active" }).uncheck();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("User updated.")).toBeVisible();
  await expectSignedOut(page);
  // A deactivated account cannot sign in, with the same message as a wrong password.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await button(page, "Sign in").click();
  await expect(formAlert(page)).toContainText("Email or password is incorrect.");
  await adminContext.close();
});
