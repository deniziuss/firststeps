// Reliability probe: run against a server whose DB_PORT points at a closed port (the database is
// never contacted). Prints what a visitor sees on public pages, sign-in and a protected page.
// Usage: node scripts/probe-db-down.mjs http://localhost:3200
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3200";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ baseURL: base });
const show = async (label) => console.log(`${label.padEnd(22)} ${(await page.locator("main").last().innerText()).replace(/\s+/g, " ").slice(0, 160)}`);

let started = Date.now();
await page.goto("/", { waitUntil: "load" });
console.log(`landing status ok, ${Date.now() - started} ms`);
await page.goto("/dashboard", { waitUntil: "networkidle" });
await show("protected /dashboard");
await page.goto("/tr/sign-in", { waitUntil: "networkidle" });
await page.getByLabel("E-posta").fill("someone@example.invalid");
await page.getByLabel("Şifre").fill("wrong-password-123");
started = Date.now();
await page.getByRole("button", { name: "Giriş yap" }).click();
await page.waitForTimeout(20000);
await show(`sign-in (+${Date.now() - started} ms)`);
await browser.close();
