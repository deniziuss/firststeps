import { expect, test } from "@playwright/test";
import { adminCredentials, button, createJourney, formAlert, mentorCredentials, openTask, PASSWORD, register, signIn, signOut, uniqueEmail, useLocale } from "./helpers";

test("anonymous visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/dashboard", "/journey", "/admin", "/mentor"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

test("students cannot read another student's data or admin pages", async ({ page }) => {
  await register(page, "Alice", uniqueEmail("a"));
  const journeyId = await createJourney(page, { arrival: "2027-04-01" });
  const taskId = await openTask(page, "Arrange health insurance");
  await signOut(page);

  // A03: student B gets "not found" for A's journey, task and report, and none of A's data.
  // (The page streams, so the HTTP status is sent before the ownership check; the content is what matters.)
  await register(page, "Bob", uniqueEmail("b"));
  for (const path of [`/journey/${journeyId}`, `/tasks/${taskId}`, `/journey/${journeyId}/report`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Arrange health insurance")).toHaveCount(0);
    await expect(page.getByText("Alice")).toHaveCount(0);
  }

  // A13: role pages redirect students to their own dashboard.
  for (const path of ["/admin", "/admin/templates", "/mentor"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});

test("help request is assigned by admin and answered by the mentor only", async ({ page }) => {
  const admin = adminCredentials();
  const mentor = mentorCredentials();
  test.skip(!admin.email || !mentor.email, "Run npm run db:seed-users first.");

  const subject = `Bus card ${Date.now()}`;
  const studentEmail = uniqueEmail("help");
  await register(page, "Carl", studentEmail);
  await createJourney(page, { arrival: "2027-05-01" });
  await openTask(page, "Learn the city public transport");
  await button(page, "Ask a mentor").click();
  await page.getByLabel("Short subject").fill(subject);
  await page.getByLabel("What is the problem?").fill("Where can I buy a monthly student bus card?");
  await button(page, "Send to a mentor").click();
  await expect(page.getByText("Your request was sent")).toBeVisible();
  const taskUrl = page.url();
  await signOut(page);

  // A12: before assignment the mentor does not see the request.
  await signIn(page, mentor.email, mentor.password);
  await expect(page).toHaveURL(/\/mentor$/);
  await expect(page.getByText(subject)).toHaveCount(0);
  await signOut(page);

  // Admin assigns the request to the mentor (trigger 51002 accepts Mentor accounts).
  await signIn(page, admin.email, admin.password);
  await page.goto("/admin/requests?status=Open");
  await page.waitForLoadState("networkidle");
  const item = page.locator(`li[data-request="${subject}"]`);
  await item.getByLabel("Mentor").selectOption({ label: "Maria Mentor (Mentor)" });
  await item.getByRole("button", { name: "Assign" }).click();
  await expect(item).toHaveCount(0); // no longer in the Open list
  await page.goto("/admin/requests?status=Assigned");
  await expect(page.locator(`li[data-request="${subject}"]`)).toContainText("mentor Maria");
  await signOut(page);

  // Mentor answers it.
  await signIn(page, mentor.email, mentor.password);
  await page.getByRole("link", { name: new RegExp(subject) }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Answer", { exact: true }).fill("Student cards are sold at the main ticket office. Check the city transport website first.");
  await button(page, "Send answer").click();
  await expect(page.getByText(/^Answer sent /)).toBeVisible();
  await signOut(page);

  // The student sees the answer on the task page.
  await signIn(page, studentEmail, PASSWORD);
  await page.goto(taskUrl);
  await expect(page.getByText("Answer from Maria")).toBeVisible();
  await expect(page.getByText("Student cards are sold at the main ticket office")).toBeVisible();
});

test("admin edits content: template, translation, cycle check", async ({ page }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  await signIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);

  // A15: a cycle is rejected with an explanation.
  await page.goto("/admin/templates");
  await page.getByRole("link", { name: "Register at the international office" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Prerequisite task").selectOption({ label: "Confirm your course enrolment" });
  await button(page, "Add prerequisite").click();
  await expect(formAlert(page)).toContainText("This would create a cycle");

  // A13: a new template reaches new journeys, and its Turkish translation is used in Turkish.
  const title = `E2E welcome pack ${Date.now()}`;
  await page.goto("/admin/templates");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title (English)").fill(title);
  await page.getByLabel("Category").fill("University");
  await button(page, "Create task").click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title (Turkish)").fill(`E2E hoş geldin paketi ${title.slice(-6)}`);
  await button(page, "Save translation").click();
  await expect(page.getByText("Translation saved.")).toBeVisible();
  const templateUrl = page.url();
  await signOut(page);

  await register(page, "Nora", uniqueEmail("tpl"));
  await createJourney(page, { arrival: "2027-06-01" });
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.goto(`/tr${new URL(page.url()).pathname}`);
  await expect(page.getByRole("link", { name: new RegExp(`E2E hoş geldin paketi ${title.slice(-6)}`) })).toBeVisible();
  await useLocale(page, "en");
  await signOut(page);

  // Deactivate the test template so it does not affect later journeys.
  await signIn(page, admin.email, admin.password);
  await page.goto(templateUrl);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Active/).uncheck();
  await button(page, "Save changes").click();
  await expect(button(page, "Save changes")).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel(/Active/)).not.toBeChecked();
});
