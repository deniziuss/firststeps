import { INTL_LOCALE, type Locale } from "./config";
import type { Messages } from "./messages/en";

// A message is a string with {placeholders}, or plural forms chosen by the `count` variable.
type PluralMessage = { one: string; other: string };
type Leaf = string | PluralMessage;

type Join<K extends string, P extends string> = `${K}.${P}`;
type Paths<T> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : Join<K, Paths<T[K]>>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;
export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

function lookup(messages: unknown, key: string): Leaf | undefined {
  let node = messages as Record<string, unknown> | undefined;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node !== "object") return undefined;
    node = node[part] as Record<string, unknown> | undefined;
  }
  return node as Leaf | undefined;
}

export function createTranslator(locale: Locale, messages: Messages, fallback?: Messages) {
  const plural = new Intl.PluralRules(INTL_LOCALE[locale]);
  const number = new Intl.NumberFormat(INTL_LOCALE[locale]);

  const t: Translate = (key, vars) => {
    const entry = lookup(messages, key) ?? (fallback ? lookup(fallback, key) : undefined);
    if (entry === undefined) return key;
    const template = typeof entry === "string" ? entry : plural.select(Number(vars?.count ?? 0)) === "one" ? entry.one : entry.other;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = vars?.[name];
      if (value === undefined) return match;
      return typeof value === "number" ? number.format(value) : value;
    });
  };

  // True when the key exists; used to translate stored keys (validation messages, categories).
  const has = (key: string) => lookup(messages, key) !== undefined;

  return { locale, t, has, format: createFormatters(locale) };
}

// DATE columns arrive as UTC midnight and DATETIME2 values are stored in UTC, so both are formatted
// in UTC: the server-rendered value matches the database and a date never shifts by a day.
export function createFormatters(locale: Locale) {
  const intl = INTL_LOCALE[locale];
  const date = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const dateTime = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const number = new Intl.NumberFormat(intl);
  const percent = new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 0 });
  return {
    date: (value: Date | string | null | undefined) => (value ? date.format(new Date(value)) : "—"),
    dateTime: (value: Date | string | null | undefined) => (value ? `${dateTime.format(new Date(value))} UTC` : "—"),
    number: (value: number) => number.format(value),
    percent: (ratio: number) => percent.format(ratio),
  };
}

export type I18n = ReturnType<typeof createTranslator>;
