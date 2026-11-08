import { BASE_URL, expect, test } from "./fixtures";
import { adminCredentials, button, createJourney, createTemplate, deactivateTemplate, openTask, ready, register, signIn, statusPanel, uniqueEmail } from "./helpers";

// Issue 001, data gap: a prerequisite that applies to the journey but was added after the journey was
// created. The task is locked (the DB trigger requires the prerequisite), and updating the plan
// adds the missing task, after which the normal prerequisite flow works.
test("a prerequisite added after the journey is repaired by updating the plan", async ({ page, browser }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  const stamp = Date.now();
  const later = `E2E later step ${stamp}`;
  const added = `E2E added prerequisite ${stamp}`;

  const adminContext = await browser.newContext({ baseURL: BASE_URL });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin.email, admin.password);
  const templates = [await createTemplate(adminPage, later)];
  try {
    await register(page, "Gina", uniqueEmail("gap"));
    const journeyId = await createJourney(page, { arrival: "2027-07-01" });

    // The admin adds a new template and makes it a prerequisite of the task the student already has.
    templates.push(await createTemplate(adminPage, added));
    await adminPage.goto(templates[0]);
    await ready(adminPage);
    await adminPage.getByLabel("Prerequisite task").selectOption({ label: added });
    await button(adminPage, "Add prerequisite").click();
    await expect(adminPage.getByText("Prerequisite added.")).toBeVisible();

    await page.goto(`/journey/${journeyId}`);
    await expect(page.getByText("Waiting for a task that is missing from your plan.").filter({ visible: true })).toBeVisible();
    await openTask(page, later);
    await expect(page).toHaveTitle(`${later} · FirstSteps`);
    await expect(page.getByText("A required task is missing from your plan")).toBeVisible();
    await expect(statusPanel(page).getByRole("button", { name: "Mark as done" })).toBeDisabled();

    await button(page, "Update my plan").click();
    await expect(page.getByText("A required task is missing from your plan")).toHaveCount(0);
    await expect(page.getByText("Finish the tasks above to unlock this one.")).toBeVisible();

    // The added prerequisite is now a normal task: do it first, then the dependent one.
    await openTask(page, added);
    await button(page, "Mark as done").click();
    await expect(page.getByText(/^Done on /)).toBeVisible();
    await page.goto(`/journey/${journeyId}`);
    await openTask(page, later);
    await button(page, "Mark as done").click();
    await expect(page.getByText(/^Done on /)).toBeVisible();
  } finally {
    await adminContext.close();
    for (const url of templates) await deactivateTemplate(browser, url);
  }
});
