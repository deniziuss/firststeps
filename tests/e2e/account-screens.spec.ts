import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { BASE_URL, expect, setLocaleCookie, test } from "./fixtures";
import { adminCredentials, ready, register, signIn, uniqueEmail } from "./helpers";

// The account screens added with migration 0006, on phones (360 and 390 px) and desktop, in English
// and Turkish, light and dark: axe-core (WCAG 2.2 AA rules), no horizontal overflow, and the
// translated heading is shown. Keyboard: every control on the page can be reached with Tab.

async function check(page: Page, label: string) {
  await ready(page);
  await expect(page).toHaveTitle(/FirstSteps/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const issues = result.violations.map((v) => `${label}: ${v.id} ${v.nodes[0]?.target.join(" ")}`);
  expect(issues, issues.join("\n")).toEqual([]);
}

const PUBLIC: { path: string; heading: { en: RegExp; tr: RegExp } }[] = [
  { path: "/forgot-password", heading: { en: /Reset your password/, tr: /Şifreni sıfırla/ } },
  { path: `/reset-password/${"A".repeat(43)}`, heading: { en: /Choose a new password/, tr: /Yeni şifre belirle/ } },
  { path: `/verify-email/${"A".repeat(43)}`, heading: { en: /Confirm your email address/, tr: /E-posta adresini doğrula/ } },
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("public account screens on phones and desktop, English and Turkish", async ({ page }) => {
      for (const width of [360, 390, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        for (const locale of ["en", "tr"] as const) {
          for (const screen of PUBLIC) {
            await page.goto(`/${locale}${screen.path}`);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(screen.heading[locale]);
            await check(page, `${locale}${screen.path.slice(0, 20)} @${width}`);
          }
        }
      }
    });

    test("verification banner and audit log on phones, English and Turkish", async ({ page, browser }) => {
      await register(page, "Mobi", uniqueEmail("screens"), { verify: false });
      const admin = adminCredentials();
      const adminContext = await browser.newContext({ baseURL: BASE_URL, colorScheme });
      const adminPage = await adminContext.newPage();
      await signIn(adminPage, admin.email, admin.password);
      for (const width of [360, 390]) {
        for (const locale of ["en", "tr"] as const) {
          await page.setViewportSize({ width, height: 800 });
          await setLocaleCookie(page.context(), locale);
          await page.goto("/dashboard");
          await expect(page.getByRole("heading", { name: locale === "en" ? "Confirm your email address" : "E-posta adresini doğrula" })).toBeVisible();
          await check(page, `dashboard banner ${locale} @${width}`);

          await adminPage.setViewportSize({ width, height: 800 });
          await setLocaleCookie(adminContext, locale);
          await adminPage.goto("/admin/audit");
          await expect(adminPage.getByRole("heading", { level: 1 })).toHaveText(locale === "en" ? "Audit log" : "Denetim kaydı");
          await check(adminPage, `audit ${locale} @${width}`);
        }
      }
      await adminContext.close();
    });
  });
}

test("keyboard: the forgot-password form is usable without a mouse", async ({ page }) => {
  await page.goto("/forgot-password");
  await ready(page);
  const email = page.getByLabel("Email");
  for (let i = 0; i < 25 && !(await email.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.type("someone@example.invalid");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-slot="alert"][role="status"]').filter({ visible: true })).toContainText("If an account exists");
});
