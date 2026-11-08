import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { adminCredentials, createAssignedRequest, createJourney, mentorCredentials, register, signIn, uniqueEmail } from "./helpers";

// Automated WCAG 2.2 A/AA checks with axe-core. They cover what can be detected automatically
// (contrast, names, labels, landmarks, ARIA); keyboard and screen reader use still need manual review.
async function audit(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  // Next.js streams the <title> of dynamic pages; wait for it before auditing.
  await expect(page).toHaveTitle(/FirstSteps/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const issues = result.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.length}x ${v.nodes[0]?.target.join(" ")}`);
  expect(issues, issues.join("\n")).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("public pages in both languages", async ({ page }) => {
      for (const prefix of ["/en", "/tr"]) {
        for (const path of ["", "/sign-in", "/register"]) {
          await page.goto(`${prefix}${path}`);
          await audit(page, `${prefix}${path || "/"}`);
        }
      }
    });

    test("student pages", async ({ page }) => {
      await register(page, "Ada", uniqueEmail(`a11y-${colorScheme}`));
      await audit(page, "onboarding");
      const journeyId = await createJourney(page, { arrival: "2027-02-01" });
      await audit(page, "journey");
      await page.getByRole("link", { name: /^Activate your student portal account/ }).click();
      const taskPath = new URL(page.url()).pathname;
      for (const prefix of ["/en", "/tr"]) {
        for (const path of ["/dashboard", "/journey", `/journey/${journeyId}`, taskPath, "/help", "/essentials", "/settings", `/journey/${journeyId}/report`]) {
          await page.goto(`${prefix}${path}`);
          await audit(page, `${prefix}${path}`);
        }
      }
    });

    test("admin pages in both languages", async ({ page }) => {
      const admin = adminCredentials();
      test.skip(!admin.email, "Run npm run db:seed-users first.");
      await signIn(page, admin.email, admin.password);
      for (const prefix of ["/en", "/tr"]) {
        for (const path of ["/admin", "/admin/requests", "/admin/templates", "/admin/templates/1", "/admin/sources", "/admin/universities", "/admin/users", "/admin/reports", "/settings"]) {
          await page.goto(`${prefix}${path}`);
          await audit(page, `${prefix}${path}`);
        }
      }
    });

    test("mentor pages in both languages", async ({ page, browser }) => {
      const mentor = mentorCredentials();
      test.skip(!mentor.email || !adminCredentials().email, "Run npm run db:seed-users first.");
      const subject = `A11y request ${Date.now()}`;
      await createAssignedRequest(browser, subject);
      await signIn(page, mentor.email, mentor.password);
      for (const prefix of ["/en", "/tr"]) {
        await page.goto(`${prefix}/mentor`);
        await audit(page, `${prefix}/mentor`);
        await page.getByRole("link", { name: new RegExp(subject) }).click();
        await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
        await audit(page, `${prefix}/mentor/requests/:id`);
        await page.goto(`${prefix}/settings`);
        await audit(page, `${prefix}/settings (mentor)`);
      }
    });
  });
}

test("keyboard: skip link, focus order and visible focus", async ({ page }) => {
  await register(page, "Kai", uniqueEmail("keys"));
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  // Every focused control shows an outline (focus visible).
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(outline).not.toBe("none");
});
