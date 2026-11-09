// Captures full-page screenshots of public pages for design review.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [--motion]
//   Default: http://localhost:3000, docs/screenshots/review, reduced motion (every section visible).
//   --motion scrolls through each page with animations enabled before capturing.
//   SCROLLS=0,900 captures viewport-sized shots at those scroll offsets instead of one full page.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const motion = process.argv.includes("--motion");
const base = args[0] ?? "http://localhost:3000";
const out = args[1] ?? "docs/screenshots/review";
mkdirSync(out, { recursive: true });

const pages = (process.env.PAGES ?? "/").split(",");
const widths = (process.env.WIDTHS ?? "360,390,768,1024,1280,1440,1920").split(",").map(Number);
const locales = (process.env.LOCALES ?? "en,tr").split(",");
const themes = (process.env.THEMES ?? "light,dark").split(",");

const browser = await chromium.launch({ channel: "msedge" });
const report = [];
for (const theme of themes) {
  for (const locale of locales) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: motion ? "no-preference" : "reduce",
        colorScheme: theme,
      });
      await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
      const page = await context.newPage();
      for (const p of pages) {
        await page.goto(`${base}/${locale}${p === "/" ? "" : p}`, { waitUntil: "networkidle" });
        if (motion) {
          for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 500) {
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(120);
          }
          await page.waitForTimeout(1500);
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page.waitForTimeout(600);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const name = `${(p === "/" ? "home" : p.replaceAll("/", "-").slice(1))}-${locale}-${theme}-${width}.png`;
        if (process.env.SCROLLS) {
          for (const y of process.env.SCROLLS.split(",").map(Number)) {
            await page.evaluate((top) => window.scrollTo(0, top), y);
            await page.waitForTimeout(300);
            await page.screenshot({ path: path.join(out, name.replace(".png", `-at${y}.png`)) });
          }
        } else {
          await page.screenshot({ path: path.join(out, name), fullPage: true });
        }
        report.push({ name, overflow });
      }
      await context.close();
    }
  }
}
await browser.close();
for (const r of report) console.log(`${r.overflow > 0 ? "OVERFLOW " + r.overflow + "px" : "ok"}  ${r.name}`);
