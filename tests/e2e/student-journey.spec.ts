import { expect, test } from "./fixtures";
import { applicableTaskCount, button, createJourney, formAlert, formStatus, goToTask, openTask, register, signOut, statusPanel, uniqueEmail } from "./helpers";

test("student registers, builds a plan and follows prerequisites", async ({ page }) => {
  await register(page, "Erin", uniqueEmail("student"));
  const journeyId = await createJourney(page, { arrival: "2027-02-01", program: "Erasmus exchange", accommodation: "Not yet" });

  // Erasmus + not arranged: Erasmus-only and housing tasks are assigned, the Confirmed-only task is not.
  await expect(page.getByRole("link", { name: /Attend orientation week/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Arrange accommodation/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Confirm check-in details/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Open a local bank account/ })).toHaveCount(0);

  // A06: the dependent task is locked; even a forced click is refused by the server.
  await openTask(page, "Activate your student portal account");
  await expect(statusPanel(page).getByText("Locked", { exact: true }).first()).toBeVisible();
  const markDone = button(page, "Mark as done");
  await expect(markDone).toBeDisabled();
  await markDone.evaluate((element) => element.removeAttribute("disabled"));
  await markDone.click();
  await expect(formAlert(page)).toContainText("Finish these tasks first: Register at the international office");

  // A07: completing the prerequisite unlocks the dependent task.
  await goToTask(page, "Register at the international office");
  await button(page, "Mark as done").click();
  await expect(formStatus(page)).toContainText("Task updated.");
  await expect(statusPanel(page).getByText(/^Done on /)).toBeVisible();
  await goToTask(page, "Activate your student portal account");
  await button(page, "Mark as done").click();
  await expect(statusPanel(page).getByText(/^Done on /)).toBeVisible();

  // Reopening the prerequisite is refused while the dependent is completed (confirmation dialog first).
  await goToTask(page, "Register at the international office");
  await button(page, "Reopen task").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reopen task" }).click();
  await expect(formAlert(page)).toContainText("Reopen the tasks that depend on this one first");

  // A08: reopening the dependent clears its completion time.
  await goToTask(page, "Activate your student portal account");
  await button(page, "Reopen task").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reopen task" }).click();
  await expect(button(page, "Mark as done")).toBeEnabled();
  await expect(statusPanel(page).getByText(/^Done on /)).toHaveCount(0);

  // A09: sources show their verification state.
  await expect(page.getByText("Not yet reviewed").first()).toBeVisible();

  // A10: help request on an own task.
  await button(page, "Ask a mentor").click();
  await page.getByLabel("Short subject").fill("Portal password");
  await page.getByLabel("What is the problem?").fill("The activation email never arrived in my inbox.");
  await button(page, "Send to a mentor").click();
  await expect(formStatus(page).filter({ hasText: "Your request was sent" })).toBeVisible();

  // A16: confirming accommodation re-plans without losing completed work.
  await page.goto(`/journey/${journeyId}`);
  await page.getByLabel("Housing").selectOption("Confirmed");
  await button(page, "Update my plan").click();
  await expect(formStatus(page)).toContainText("Plan updated: 1 added, 1 no longer needed");
  await expect(page.getByRole("link", { name: /Confirm check-in details/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Arrange accommodation/ })).toContainText("Not needed");
  await expect(page.getByRole("link", { name: /Register at the international office/ })).toContainText("Done");
  const total = await applicableTaskCount(page, "Not needed");
  await expect(page.getByText(`1 of ${total} tasks done`, { exact: true })).toBeVisible();

  // A14 / A17: the dashboard counts the same tasks as the journey page; the report lists them.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your next step" })).toBeVisible();
  await expect(page.getByText(`1 of ${total} tasks done`, { exact: true })).toBeVisible();
  await page.goto(`/journey/${journeyId}/report`);
  await expect(page.getByRole("heading", { name: "Open tasks in order" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Register at the international office" })).toBeVisible();
});

test("duplicate registration and duplicate journey are rejected", async ({ page }) => {
  const email = uniqueEmail("dup");
  await register(page, "Dana", email);
  await createJourney(page, { arrival: "2027-03-01" });

  await page.goto("/onboarding");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("When do you arrive?").fill("2027-03-01");
  await page.getByRole("button", { name: "Create my plan" }).click();
  await expect(formAlert(page)).toContainText("You already have a plan for this university and arrival date.");

  await signOut(page);
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("First name").fill("Dana");
  await page.getByLabel("Last name").fill("Again");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Another-pass-123");
  await page.getByLabel("Confirm password").fill("Another-pass-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(formAlert(page)).toContainText("already exists");
});

test("invalid input shows field errors and a wrong password does not sign in", async ({ page }) => {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("nobody@example.invalid");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(formAlert(page)).toContainText("Email or password is incorrect");
});
