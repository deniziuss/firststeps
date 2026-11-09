import "server-only";
import { headers } from "next/headers";
import { countEvent } from "./metrics";

/**
 * Structured server log: one JSON object per line on stdout/stderr, so any log collector can parse it.
 *
 * Fields: time (UTC), level, category, event, requestId (from the proxy's x-request-id header when the
 * call happens during a request), and a small context object.
 *
 * Never logged: passwords, password hashes, session tokens, reset/verification tokens, connection
 * strings, request bodies. Email addresses inside messages are masked; callers pass ids, not names.
 */
type Level = "info" | "warn" | "error";
export type LogCategory = "auth" | "admin" | "db" | "mail" | "health" | "app" | "rate_limit" | "perf";
type Context = Record<string, string | number | boolean | undefined | null>;

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const SECRET_KEYS = /password|token|secret|hash|cookie|authorization/i;

function sanitize(context: Context): Context {
  const clean: Context = {};
  for (const [key, value] of Object.entries(context)) {
    if (SECRET_KEYS.test(key)) clean[key] = "[redacted]";
    else clean[key] = typeof value === "string" ? value.replace(EMAIL, "<email>").slice(0, 300) : value;
  }
  return clean;
}

async function requestId(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-request-id") ?? undefined;
  } catch {
    return undefined; // outside a request (scripts, startup)
  }
}

export async function log(level: Level, category: LogCategory, event: string, context: Context = {}) {
  countEvent(level, category, event);
  const line = JSON.stringify({ time: new Date().toISOString(), level, category, event, requestId: await requestId(), ...sanitize(context) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logError(event: string, error: unknown, context: Context = {}, category: LogCategory = "app") {
  const e = (error ?? {}) as { name?: string; code?: string; number?: number; message?: string; originalError?: { info?: { number?: number } } };
  void log("error", category, event, {
    ...context,
    errorName: e.name,
    errorCode: e.code,
    sqlNumber: e.number ?? e.originalError?.info?.number,
    message: typeof e.message === "string" ? e.message : undefined,
  });
}
