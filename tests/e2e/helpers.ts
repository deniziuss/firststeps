import { expect, type Page } from "@playwright/test";

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
  // Host-only, like the cookie the proxy sets, so it replaces that cookie instead of adding a second one.
  await page.context().addCookies([{ name: "fs_locale", value: locale, url: new URL("/", page.url()).href }]);
}

// The task page's status panel (English or Turkish heading).
export function statusPanel(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: /^(Status|Durum)$/ }) }).filter({ visible: true });
}
