import { expect, test } from "./fixtures";
import { applicableTaskCount, button, formAlert, formStatus, latestMail, statusPanel, uniqueEmail, verifyEmail } from "./helpers";

const PASSWORD = "Turkce-akis-2026";

test("language switch is available before sign-in and persists across pages and visits", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("menuitem", { name: "Türkçe" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Yeni bir ülke");

  // The URL stays clean; the choice is stored and used on other pages and in a new tab.
  expect(new URL(page.url()).pathname).toBe("/");
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Tekrar hoş geldin" })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/register");
  await expect(other.getByRole("heading", { name: "Öğrenci hesabını oluştur" })).toBeVisible();

  await page.getByRole("button", { name: "Dili değiştir" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("full student flow in Turkish: register, plan, complete a task, ask for help", async ({ page }) => {
  await page.goto("/tr/register");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");

  // Validation messages are translated.
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page.getByText("Bu alanı doldurman gerekiyor.").first()).toBeVisible();

  await page.getByLabel("Ad", { exact: true }).fill("Elif");
  await page.getByLabel("Soyad").fill("Deneme");
  const email = uniqueEmail("tr");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Şifre (tekrar)").fill(PASSWORD);
  await page.getByRole("button", { name: "Hesap oluştur" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Hoş geldin, Elif" })).toBeVisible();

  // The verification email is written in the language of the registration, and confirming works in Turkish.
  expect((await latestMail(email, "/verify-email/")).subject).toBe("FirstSteps e-posta adresini doğrula");
  await verifyEmail(page, email);
  await page.goto("/onboarding");

  await page.waitForLoadState("networkidle");
  await page.getByLabel("Ne zaman varıyorsun?").fill("2027-02-01");
  await page.getByRole("radio", { name: /Erasmus değişimi/ }).check();
  await page.getByRole("radio", { name: /Henüz değil/ }).check();
  await page.getByRole("button", { name: "Planımı oluştur" }).click();
  await expect(page).toHaveURL(/\/journey\/\d+$/);

  // Database content comes from the Turkish translations; stages and statuses are Turkish.
  await expect(page.getByRole("heading", { name: /Varıştan önce/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Kalacak yer ayarla/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Öğrenci portalı hesabını etkinleştir/ })).toContainText("Kilitli");

  // Dates use Turkish formatting.
  await expect(page.getByText("Varış 1 Şub 2027")).toBeVisible();
  const total = await applicableTaskCount(page, "Gerekmiyor");
  expect(total).toBeGreaterThan(0);

  await page.getByRole("link", { name: /^Uluslararası ofise kayıt ol/ }).click();
  await page.waitForLoadState("networkidle");
  await button(page, "Tamamlandı olarak işaretle").click();
  await expect(formStatus(page)).toContainText("Görev güncellendi.");
  await expect(statusPanel(page).getByText(/tarihinde tamamlandı$/)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Sıradaki adımın" })).toBeVisible();
  // The dashboard counts the same tasks the journey page lists.
  await expect(page.getByText(`${total} görevden 1 tanesi tamamlandı`, { exact: true })).toBeVisible();

  // A locked task explains why in Turkish, and the server refuses a forced completion in Turkish.
  await page.goto(new URL(page.url()).origin + "/journey");
  await page.getByRole("link", { name: /RTU Liepāja Academy/ }).first().click();
  await page.getByRole("link", { name: /^Ders kaydını kontrol et/ }).click();
  await page.waitForLoadState("networkidle");
  const markDone = button(page, "Tamamlandı olarak işaretle");
  await expect(markDone).toBeDisabled();
  await markDone.evaluate((element) => element.removeAttribute("disabled"));
  await markDone.click();
  await expect(formAlert(page)).toContainText("Önce şu görevleri tamamla: Öğrenci portalı hesabını etkinleştir");

  await button(page, "Mentora sor").click();
  await page.getByLabel("Kısa bir başlık").fill("Ders kaydı");
  await page.getByLabel("Sorun nedir?").fill("Portal hesabım henüz açılmadı, ne yapmalıyım?");
  await button(page, "Mentora gönder").click();
  await expect(formStatus(page).filter({ hasText: "Talebin gönderildi" })).toBeVisible();

  await page.goto("/help");
  await expect(page.getByText("Mentor bekleniyor")).toBeVisible();
});
