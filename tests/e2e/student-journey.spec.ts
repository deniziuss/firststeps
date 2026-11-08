import { expect, test } from "@playwright/test";
import { completedAt, createJourney, formAlert, formStatus, goToTask, openTask, register, setStatus, signOut, uniqueEmail } from "./helpers";

test("student registers, builds a plan and follows prerequisites", async ({ page }) => {
  await register(page, "Erin", uniqueEmail("student"));
  const journeyId = await createJourney(page, { arrival: "2027-02-01", program: "Erasmus", accommodation: "NotArranged" });

  // Erasmus + not arranged: Erasmus-only and housing tasks are assigned, the Confirmed-only task is not.
  await expect(page.getByRole("link", { name: /Attend orientation week/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Arrange accommodation/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Confirm check-in details/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open a local bank account/ })).toHaveCount(0);

  // A06: the dependent task cannot be completed first, even when the disabled option is forced.
  await openTask(page, "Activate your student portal account");
  await expect(page.getByText("Locked").first()).toBeVisible();
  await page.evaluate(() => {
    const option = document.querySelector<HTMLOptionElement>('select[name=status] option[value="Completed"]')!;
    option.disabled = false;
  });
  await setStatus(page, "Completed");
  await expect(formAlert(page)).toContainText("Complete these tasks first: Register at the international office");

  // A07: completing the prerequisite unlocks the dependent task.
  await goToTask(page, "Register at the international office");
  await setStatus(page, "Completed");
  await expect(formStatus(page)).toContainText("Task updated.");
  await expect(completedAt(page)).toBeVisible();
  await goToTask(page, "Activate your student portal account");
  await setStatus(page, "Completed");
  await expect(formStatus(page)).toContainText("Task updated.");
  await expect(completedAt(page)).toBeVisible();

  // Reopening the prerequisite is refused while the dependent is completed.
  await goToTask(page, "Register at the international office");
  await setStatus(page, "Pending");
  await expect(formAlert(page)).toContainText("Reopen the tasks that depend on this one first");

  // A08: reopening the dependent clears its completion time.
  await goToTask(page, "Activate your student portal account");
  await setStatus(page, "Pending");
  await expect(formStatus(page)).toContainText("Task updated.");
  await expect(completedAt(page)).toHaveCount(0);

  // A09: sources show their verification state.
  await expect(page.getByText("Review pending").first()).toBeVisible();

  // A10: help request on an own task.
  await page.getByLabel("Subject").fill("Portal password");
  await page.getByLabel("What is the problem?").fill("The activation email never arrived in my inbox.");
  await page.getByRole("button", { name: "Ask a mentor" }).click();
  await expect(formStatus(page).filter({ hasText: "Your request was sent" })).toBeVisible();

  // A16: confirming accommodation re-plans without losing completed work.
  await page.goto(`/journey/${journeyId}`);
  await page.getByLabel("Accommodation status").selectOption("Confirmed");
  await page.getByRole("button", { name: "Update plan" }).click();
  await expect(formStatus(page)).toContainText("Plan updated: 1 added, 1 no longer needed");
  await expect(page.getByRole("link", { name: /Confirm check-in details/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Arrange accommodation/ })).toContainText("Not applicable");
  await expect(page.getByRole("link", { name: /Register at the international office/ })).toContainText("Completed");

  // A14 / A17: dashboard and report use the stored data.
  await page.goto("/dashboard");
  await expect(page.getByText("Overall progress")).toBeVisible();
  await page.goto(`/journey/${journeyId}/report`);
  await expect(page.getByRole("heading", { name: "Open tasks in order" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Register at the international office" })).toBeVisible();
});

test("duplicate registration and duplicate journey are rejected", async ({ page }) => {
  const email = uniqueEmail("dup");
  await register(page, "Dana", email);
  await createJourney(page, { arrival: "2027-03-01" });

  await page.goto("/onboarding");
  await page.getByLabel("Arrival date").fill("2027-03-01");
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(formAlert(page)).toContainText("already have a journey");

  await signOut(page);
  await page.goto("/register");
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Again");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Another-pass-123");
  await page.getByLabel("Confirm password").fill("Another-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(formAlert(page)).toContainText("already exists");
});

test("wrong password does not sign in", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("nobody@example.invalid");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(formAlert(page)).toContainText("Email or password is incorrect");
});
