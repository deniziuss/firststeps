import type { Page } from "@playwright/test";
import { BASE_URL, expect, test } from "./fixtures";
import { adminCredentials, button, createJourney, createTemplate, deactivateTemplate, openTask, ready, register, signIn, statusPanel, uniqueEmail } from "./helpers";

// Migration 0003 / Issue 001: a prerequisite that genuinely does not apply to a journey no longer locks
// the dependent task, both when it was never part of the plan and when re-planning marked it
// "Not needed". A prerequisite that applies is still required (see also plan-repair.spec.ts).
test("a prerequisite that does not apply to the student does not lock the dependent task", async ({ page, browser }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  const stamp = Date.now();
  const dependent = `E2E move-in check ${stamp}`;
  const housingOnly = `E2E find housing ${stamp}`;

  const adminContext = await browser.newContext({ baseURL: BASE_URL });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin.email, admin.password);
  const templates = [await createTemplate(adminPage, dependent, "Housing"), await createTemplate(adminPage, housingOnly, "Housing")];
  try {
    // The prerequisite applies only to students without housing.
    await adminPage.goto(templates[1]);
    await ready(adminPage);
    await adminPage.locator('select[name="accommodationCondition"]').selectOption("NotArranged");
    await button(adminPage, "Save changes").click();
    await expect(button(adminPage, "Save changes")).toBeEnabled();

    // The admin is warned that some students skip it, and confirms.
    await adminPage.goto(templates[0]);
    await ready(adminPage);
    await adminPage.getByLabel("Prerequisite task").selectOption({ label: housingOnly });
    await button(adminPage, "Add prerequisite").click();
    await expect(adminPage.getByText(/For them the prerequisite is skipped/)).toBeVisible();
    await adminPage.getByLabel("I understand that for these students the prerequisite is skipped.").check();
    await button(adminPage, "Add prerequisite").click();
    await expect(adminPage.getByText("Prerequisite added.")).toBeVisible();

    // A. Housing already arranged: the prerequisite was never added, and the task can be completed.
    await register(page, "Noor", uniqueEmail("rule-absent"));
    const confirmed = await createJourney(page, { arrival: "2027-09-01", accommodation: "Yes, it's arranged" });
    await page.goto(`/journey/${confirmed}`);
    await expect(page.getByRole("link", { name: new RegExp(housingOnly) })).toHaveCount(0);
    await openTask(page, dependent);
    await markDone(page);

    // B. No housing yet: the prerequisite is in the plan and locks the task until the plan changes.
    const notArranged = await createJourney(page, { arrival: "2027-09-02", accommodation: "Not yet" });
    await openTask(page, dependent);
    await expect(statusPanel(page).getByRole("button", { name: "Mark as done" })).toBeDisabled();
    await page.goto(`/journey/${notArranged}`);
    await ready(page);
    await page.getByRole("combobox", { name: "Housing" }).selectOption("Confirmed");
    await button(page, "Update my plan").click();
    await expect(page.getByText(/no longer needed|Plan updated/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(housingOnly) })).toContainText("Not needed");
    await openTask(page, dependent);
    await markDone(page);
  } finally {
    await adminContext.close();
    for (const url of templates) await deactivateTemplate(browser, url);
  }
});

async function markDone(page: Page) {
  const done = statusPanel(page).getByRole("button", { name: "Mark as done" });
  await expect(done).toBeEnabled();
  await done.click();
  await expect(page.getByText(/^Done on /)).toBeVisible();
}
