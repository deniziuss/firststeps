import type { Browser, Page } from "@playwright/test";
import { BASE_URL, expect, setLocaleCookie } from "./fixtures";

export const PASSWORD = `E2e-${Date.now()}-pass`;

export function uniqueEmail(label: string) {
  return `e2e+${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.invalid`;
}

// Wait until the page has loaded and hydrated before typing or submitting forms.
export async function ready(page: Page) {
  await page.waitForLoadState("networkidle");
}

export async function register(page: Page, firstName: string, email: string) {
  await page.goto("/register");
  await ready(page);
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await ready(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in$/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /^(Sign out|Çıkış yap)$/ }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

export async function createJourney(page: Page, options: { arrival: string; program?: string; accommodation?: string }) {
  await page.goto("/onboarding");
  await ready(page);
  await page.getByLabel("When do you arrive?").fill(options.arrival);
  if (options.program) await page.getByRole("radio", { name: new RegExp(options.program) }).check();
  if (options.accommodation) await page.getByRole("radio", { name: new RegExp(options.accommodation) }).check();
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(page).toHaveURL(/\/journey\/\d+$/);
  return Number(page.url().split("/").pop());
}

// Next.js keeps recently visited pages mounted but hidden, so only act on visible controls.
export async function openTask(page: Page, title: string) {
  await page.getByRole("link", { name: new RegExp(title) }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title }).filter({ visible: true })).toBeVisible();
  await ready(page);
  return Number(page.url().split("/").pop());
}

// Follows a task link on the current page and waits until that task's page is shown.
export async function goToTask(page: Page, title: string) {
  await page.getByRole("link", { name: title, exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title }).filter({ visible: true })).toBeVisible();
  await ready(page);
}

export function button(page: Page, name: string | RegExp) {
  return page.getByRole("button", { name }).filter({ visible: true });
}

export function adminCredentials() {
  return { email: process.env.DEV_ADMIN_EMAIL!, password: process.env.DEV_ADMIN_PASSWORD! };
}

export function mentorCredentials() {
  return { email: process.env.DEV_MENTOR_EMAIL!, password: process.env.DEV_MENTOR_PASSWORD! };
}

// Next.js renders its own role="alert" route announcer, so target the form messages directly.
export function formAlert(page: Page) {
  return page.locator('[data-slot="alert"][role="alert"]').filter({ visible: true });
}

export function formStatus(page: Page) {
  return page.locator('[data-slot="alert"][role="status"]').filter({ visible: true });
}

// Sets the language cookie for the whole site (the proxy reads it on every request).
export async function useLocale(page: Page, locale: "en" | "tr") {
  await setLocaleCookie(page.context(), locale);
}

// The task page's status panel (English or Turkish heading).
export function statusPanel(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: /^(Status|Durum)$/ }) }).filter({ visible: true });
}

// Tasks listed on the journey page that still apply (rows marked "not needed" are excluded),
// so progress assertions compare against what the student actually sees.
export async function applicableTaskCount(page: Page, notNeededLabel: string) {
  const rows = page.locator('main a[href^="/tasks/"]').filter({ visible: true });
  const total = await rows.count();
  const notNeeded = await rows.filter({ hasText: notNeededLabel }).count();
  return total - notNeeded;
}

// Deactivates a test template from its own admin session, so a failure mid-test cannot leave it
// active and change the task lists of later tests.
export async function deactivateTemplate(browser: Browser, templateUrl: string) {
  const admin = adminCredentials();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await signIn(page, admin.email, admin.password);
  await page.goto(templateUrl);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Active/).uncheck();
  await button(page, "Save changes").click();
  await expect(button(page, "Save changes")).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel(/Active/)).not.toBeChecked();
  await context.close();
}

// Creates an active task template from an admin page and returns its URL.
export async function createTemplate(page: Page, title: string, category = "University") {
  await page.goto("/admin/templates");
  await ready(page);
  await page.getByLabel("Title (English)").fill(title);
  await page.getByLabel("Category").fill(category);
  await button(page, "Create task").click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await ready(page);
  return page.url();
}

// A help request from a new synthetic student, assigned to the seeded mentor by the admin.
// Runs in its own browser contexts, so the calling test's session is not touched.
export async function createAssignedRequest(browser: Browser, subject: string) {
  const student = await browser.newContext({ baseURL: BASE_URL });
  const studentPage = await student.newPage();
  await setLocaleCookie(student, "en");
  await register(studentPage, "Rhea", uniqueEmail("req"));
  await createJourney(studentPage, { arrival: "2027-08-01" });
  await openTask(studentPage, "Learn the city public transport");
  await button(studentPage, "Ask a mentor").click();
  await studentPage.getByLabel("Short subject").fill(subject);
  await studentPage.getByLabel("What is the problem?").fill("Synthetic request for an automated check.");
  await button(studentPage, "Send to a mentor").click();
  await expect(studentPage.getByText("Your request was sent")).toBeVisible();
  await student.close();

  const admin = adminCredentials();
  const adminContext = await browser.newContext({ baseURL: BASE_URL });
  const adminPage = await adminContext.newPage();
  await setLocaleCookie(adminContext, "en");
  await signIn(adminPage, admin.email, admin.password);
  await adminPage.goto("/admin/requests?status=Open");
  await ready(adminPage);
  const item = adminPage.locator(`li[data-request="${subject}"]`);
  await item.getByLabel("Mentor").selectOption({ label: "Maria Mentor (Mentor)" });
  await item.getByRole("button", { name: "Assign" }).click();
  await expect(item).toHaveCount(0);
  await adminContext.close();
}
