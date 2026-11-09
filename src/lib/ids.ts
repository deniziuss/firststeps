// Database ids are SQL Server INT IDENTITY values (1 … 2,147,483,647). Route segments, query strings
// and form fields are parsed with this rule, so an out-of-range or malformed value is treated as
// "not found" instead of reaching the database driver and failing with a server error.
export const MAX_DB_ID = 2_147_483_647;

export function parseId(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  if (!/^[1-9]\d{0,9}$/.test(text)) return undefined;
  const id = Number(text);
  return id <= MAX_DB_ID ? id : undefined;
}
