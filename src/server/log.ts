import "server-only";

// Structured server log lines (one JSON object per line). Only error metadata is written: never
// passwords, tokens, connection strings or request bodies. Email addresses inside driver messages
// (for example in constraint errors) are masked.
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

export function logError(event: string, error: unknown, context: Record<string, string | number | undefined> = {}) {
  const e = (error ?? {}) as { name?: string; code?: string; number?: number; message?: string; originalError?: { info?: { number?: number } } };
  const line = {
    time: new Date().toISOString(),
    level: "error",
    event,
    ...context,
    name: e.name,
    code: e.code,
    sqlNumber: e.number ?? e.originalError?.info?.number,
    message: typeof e.message === "string" ? e.message.replace(EMAIL, "<email>").slice(0, 300) : undefined,
  };
  console.error(JSON.stringify(line));
}
