export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "fs_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Region used for Intl formatting (day-month order, 24-hour clock).
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", tr: "tr-TR" };

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", tr: "Türkçe" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
