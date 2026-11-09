import type { Page } from "@playwright/test";
import { expect, setLocaleCookie, test } from "./fixtures";
import { adminCredentials, createJourney, mentorCredentials, ready, register, signIn, uniqueEmail } from "./helpers";

// Design evidence, not a regression test: captures the redesigned screens for every role in both
// languages and themes. Runs only with CAPTURE=1 (e.g. `CAPTURE=1 npx playwright test visual`).
// Its synthetic student is removed by the normal end-of-run cleanup.
test.skip(!process.env.CAPTURE, "Set CAPTURE=1 to capture design screenshots");
test.setTimeout(240_000);

const OUT = "docs/screenshots/redesign";

async function shot(page: Page, name: string, fullPage = true) {
  await ready(page);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name} has horizontal overflow`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
}

for (const theme of ["light", "dark"] as const) {
  test(`all roles, ${theme}`, async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);

    // Student: register, plan, dashboard, journey, task.
    await register(page, "Elif", uniqueEmail(`visual-${theme}`));
    await createJourney(page, { arrival: "2027-02-01" });
    for (const locale of ["en", "tr"] as const) {
      await setLocaleCookie(page.context(), locale);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const tag = `${locale}-${theme}-${width}`;
        await page.goto("/dashboard");
        await shot(page, `student-dashboard-${tag}`);
        await page.goto("/journey");
        await page.locator('main a[href^="/journey/"]').first().click();
        await shot(page, `student-journey-${tag}`);
        await page.locator('main a[href^="/tasks/"]').filter({ visible: true }).first().click();
        await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
        await shot(page, `student-task-${tag}`);
        await page.goto("/onboarding");
        await shot(page, `student-onboarding-${tag}`);
      }
    }

    // Signed-out pages.
    const guest = await browser.newContext({ baseURL: page.url().split("/").slice(0, 3).join("/"), colorScheme: theme, reducedMotion: "reduce" });
    await guest.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const guestPage = await guest.newPage();
    for (const width of [1280, 390]) {
      await guestPage.setViewportSize({ width, height: 900 });
      for (const path of ["/en/sign-in", "/tr/register"]) {
        await guestPage.goto(path);
        await shot(guestPage, `auth${path.replaceAll("/", "-")}-${theme}-${width}`);
      }
    }

    // Mentor and admin.
    for (const [role, creds, paths] of [
      ["mentor", mentorCredentials(), ["/mentor"]],
      ["admin", adminCredentials(), ["/admin", "/admin/templates", "/admin/requests", "/admin/sources"]],
    ] as const) {
      await guestPage.setViewportSize({ width: 1280, height: 900 });
      await guest.clearCookies();
      await signIn(guestPage, creds.email, creds.password);
      for (const path of paths) {
        await guestPage.goto(path);
        await shot(guestPage, `${role}${path.replaceAll("/", "-")}-en-${theme}-1280`);
      }
    }
    await guest.close();
  });
}
