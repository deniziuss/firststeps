// Links that come from the database are rendered only when they are plain http(s) URLs, so a
// record written before validation (or directly in SQL) cannot become a javascript: or data: link.
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
