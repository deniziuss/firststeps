import { expect, type Page } from "@playwright/test";

export const PASSWORD = `E2e-${Date.now()}-pass`;

// Wait until the page has loaded and hydrated before typing or submitting forms.
export async function ready(page: Page) {
  await page.waitForLoadState("networkidle");
}

export function uniqueEmail(label: string) {
  return `e2e+${label}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.invalid`;
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
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

export async function createJourney(page: Page, options: { arrival: string; program?: string; accommodation?: string }) {
  await page.goto("/onboarding");
  await ready(page);
  await page.getByLabel("Arrival date").fill(options.arrival);
  if (options.program) await page.getByLabel("Programme").selectOption(options.program);
  if (options.accommodation) await page.getByLabel("Accommodation").selectOption(options.accommodation);
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(page).toHaveURL(/\/journey\/\d+$/);
  return Number(page.url().split("/").pop());
}

export async function openTask(page: Page, title: string) {
  await page.getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title }).filter({ visible: true })).toBeVisible();
  await ready(page);
  return Number(page.url().split("/").pop());
}

// Next.js keeps recently visited pages mounted but hidden, so only act on visible controls.
export async function setStatus(page: Page, status: string) {
  await page.getByLabel("Task status").filter({ visible: true }).selectOption(status);
  await page.getByRole("button", { name: "Save status" }).filter({ visible: true }).click();
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

// Follows a task link on the current page and waits until that task's page is shown.
export async function goToTask(page: Page, title: string) {
  await page.getByRole("link", { name: title, exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title }).filter({ visible: true })).toBeVisible();
  await ready(page);
}

export function completedAt(page: Page) {
  return page.getByText(/^Completed \d/).filter({ visible: true });
}
