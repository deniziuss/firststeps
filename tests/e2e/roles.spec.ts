import { expect, test } from "@playwright/test";
import { adminCredentials, createJourney, formAlert, formStatus, mentorCredentials, openTask, PASSWORD, register, signIn, signOut, uniqueEmail } from "./helpers";

test("anonymous visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/dashboard", "/journey", "/admin", "/mentor"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

test("students cannot read another student's data or admin pages", async ({ page }) => {
  // Student A creates a journey and a task URL.
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
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel("What is the problem?").fill("Where can I buy a monthly student bus card?");
  await page.getByRole("button", { name: "Ask a mentor" }).click();
  await expect(formStatus(page)).toContainText("Your request was sent");
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
  const card = page.locator('[data-slot="card"]', { hasText: subject });
  await card.getByLabel("Mentor").selectOption({ label: "Maria Mentor (Mentor)" });
  await card.getByRole("button", { name: "Assign" }).click();
  await expect(card).toHaveCount(0); // no longer in the Open list
  await page.goto("/admin/requests?status=Assigned");
  await expect(page.locator('[data-slot="card"]', { hasText: subject })).toContainText("mentor Maria");
  await signOut(page);

  // Mentor answers it.
  await signIn(page, mentor.email, mentor.password);
  await page.getByRole("link", { name: new RegExp(subject) }).click();
  await page.getByLabel("Answer").fill("Student cards are sold at the main ticket office. Check the city transport website first.");
  await page.getByRole("button", { name: "Send answer and resolve" }).click();
  await expect(page.getByText(/^Answer sent/)).toBeVisible();
  await signOut(page);

  // The student sees the answer on the task page.
  await signIn(page, studentEmail, PASSWORD);
  await page.goto(taskUrl);
  await expect(page.getByText("Answer from Maria")).toBeVisible();
  await expect(page.getByText("Student cards are sold at the main ticket office")).toBeVisible();
});

test("admin edits content: template, cycle check and source review", async ({ page }) => {
  const admin = adminCredentials();
  test.skip(!admin.email, "Run npm run db:seed-users first.");
  await signIn(page, admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);

  // A15: a cycle is rejected with an explanation.
  await page.goto("/admin/templates");
  await page.getByRole("link", { name: "Register at the international office" }).click();
  await page.getByLabel("Prerequisite task").selectOption({ label: "Confirm your course enrolment" });
  await page.getByRole("button", { name: "Add prerequisite" }).click();
  await expect(formAlert(page)).toContainText("This would create a cycle");

  // A13: a new template reaches new journeys.
  const title = `E2E welcome pack ${Date.now()}`;
  await page.goto("/admin/templates");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category").fill("University");
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const templateUrl = page.url();
  await signOut(page);

  await register(page, "Nora", uniqueEmail("tpl"));
  await createJourney(page, { arrival: "2027-06-01" });
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await signOut(page);

  // Deactivate the test template so it does not affect later journeys.
  await signIn(page, admin.email, admin.password);
  await page.goto(templateUrl);
  await page.getByLabel(/Active/).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel(/Active/)).not.toBeChecked();
});
