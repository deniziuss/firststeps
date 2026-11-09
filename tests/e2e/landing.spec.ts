import { expect, test } from "./fixtures";
import { ready } from "./helpers";

test("landing: dependency demo follows the real prerequisite rules and saves nothing", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const demo = page.getByRole("list", { name: "Example tasks" });
  const items = demo.getByRole("listitem");
  const action = (i: number) => items.nth(i).getByRole("button");

  // Only the first task is available; the others wait for their prerequisite.
  await expect(action(0)).toHaveText(/Mark as done/);
  await expect(action(1)).toBeDisabled();
  await expect(items.nth(1)).toContainText("Waits for “Register at the university”");

  await action(0).click();
  await expect(page.getByRole("status").filter({ hasText: "is now available" })).toHaveText(/“Get your student documents” is now available/);
  await expect(action(1)).toBeEnabled();
  await action(1).click();

  // A completed prerequisite cannot be reopened while its dependent task is completed.
  await expect(action(0)).toHaveText(/Undo/);
  await expect(action(0)).toBeDisabled();
  await expect(action(2)).toBeEnabled();
  await expect(page.getByText("2 of 3 done")).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(action(1)).toBeDisabled();
  await expect(page.getByText("0 of 3 done")).toBeVisible();

  // Nothing was persisted: a fresh load starts from the beginning.
  await page.reload();
  await ready(page);
  await expect(page.getByRole("list", { name: "Example tasks" }).getByRole("listitem").nth(1).getByRole("button")).toBeDisabled();
});

test("landing: section links scroll to their sections and mark the active one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await ready(page);
  const nav = page.getByRole("navigation", { name: "Site" }).first();
  await nav.getByRole("link", { name: "Features" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Built around the first weeks/ })).toBeInViewport({ timeout: 5000 });
  await expect(nav.getByRole("link", { name: "Features" })).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/\/(en\/?)?(#features)?$/);
});

test("landing: mobile menu opens, navigates and has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByRole("link", { name: "Sign in" })).toBeVisible();
  await menu.getByRole("link", { name: /Student support/ }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole("heading", { level: 2, name: /Stuck\? Ask right where/ })).toBeInViewport({ timeout: 5000 });
});

test("landing: with reduced motion all content is visible without scrolling animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tr");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeni bir ülke. Daha net bir yol.");
  const hidden = await page.evaluate(
    () => [...document.querySelectorAll("[data-reveal], [data-motion], [data-split]")].filter((el) => Number(getComputedStyle(el).opacity) < 1).length,
  );
  expect(hidden).toBe(0);
});
