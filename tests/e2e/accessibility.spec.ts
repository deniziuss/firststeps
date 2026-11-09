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

// The landing page animates content in. Scroll through it once and wait until every entrance and
// scroll-triggered animation has finished, so axe measures the final colours, not a mid-fade frame.
async function settleMotion(page: Page) {
  await page.waitForLoadState("networkidle");
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(3500);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("public pages in both languages", async ({ page }) => {
      for (const prefix of ["/en", "/tr"]) {
        for (const path of ["", "/sign-in", "/register", "/forgot-password", `/reset-password/${"A".repeat(43)}`, `/verify-email/${"A".repeat(43)}`]) {
          await page.goto(`${prefix}${path}`);
          if (path === "") await settleMotion(page);
          await audit(page, `${prefix}${path || "/"}`);
        }
      }
    });

    test("landing page with reduced motion (every section visible at once)", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const prefix of ["/en", "/tr"]) {
        await page.goto(prefix);
        await audit(page, `${prefix}/ (reduced motion)`);
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
        for (const path of ["/admin", "/admin/requests", "/admin/templates", "/admin/templates/1", "/admin/sources", "/admin/universities", "/admin/users", "/admin/reports", "/admin/audit", "/settings"]) {
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

test("settings data panel: no horizontal overflow on a phone and the export link works by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await register(page, "Mia", uniqueEmail("a11y-data"));
  for (const prefix of ["/tr", "/en"]) {
    await page.goto(`${prefix}/settings`);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${prefix}/settings horizontal overflow`).toBeLessThanOrEqual(0);
  }
  const link = page.getByRole("link", { name: "Download my data (JSON)" });
  await link.focus();
  await expect(link).toBeFocused();
  expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toMatch(/^firststeps-account-\d+\.json$/);
});

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
