import "server-only";
import { cookies } from "next/headers";
import { locale as rootLocale } from "next/root-params";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { MESSAGES } from "./messages";
import { createTranslator } from "./translator";

function translator(locale: Locale) {
  return createTranslator(locale, MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]);
}

// Server components: the locale is the root [locale] segment.
export const getI18n = cache(async () => {
  const value = await rootLocale();
  return translator(isLocale(value) ? value : DEFAULT_LOCALE);
});

// Server actions cannot read root params; the proxy keeps the locale cookie in sync with the URL.
export async function getActionI18n() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return translator(isLocale(value) ? value : DEFAULT_LOCALE);
}
