import type { I18n } from "@/i18n/translator";

// Categories are free text in Task_Templates; known ones are translated, others shown as stored.
export function categoryLabel({ t, has }: Pick<I18n, "t" | "has">, category: string) {
  const key = `categories.${category}`;
  return has(key) ? t(key as "categories.University") : category;
}
