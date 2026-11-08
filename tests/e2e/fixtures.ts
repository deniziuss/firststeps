import { test as base, type BrowserContext } from "@playwright/test";

export const BASE_URL = "http://localhost:3100";

// Host-only cookie on "/", exactly like the one the proxy sets, so setting it replaces the
// existing value instead of adding a second cookie with the same name.
export async function setLocaleCookie(context: BrowserContext, locale: "en" | "tr") {
  await context.addCookies([{ name: "fs_locale", value: locale, url: `${BASE_URL}/` }]);
}

// Every test starts in its own context, signed out and in English. Tests that need Turkish
// switch explicitly, so no test depends on the language another test left behind.
export const test = base.extend<{ englishByDefault: void }>({
  englishByDefault: [
    async ({ context }, use) => {
      await setLocaleCookie(context, "en");
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
