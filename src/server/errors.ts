import { logError } from "./log";
import type { MessageKey, Translate, Vars } from "@/i18n/translator";

// Errors that are safe to show to the user. They carry a message key and are translated at the
// server action boundary. Anything else is logged and replaced by a generic message.
export class AppError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly vars?: Vars,
    readonly code: "validation" | "conflict" | "forbidden" | "notFound" | "rule" = "rule",
  ) {
    super(key);
    this.name = "AppError";
  }
}

const DB_ERRORS: Record<number, () => AppError> = {
  51001: () => new AppError("errors.prerequisitesPending"),
  51002: () => new AppError("errors.mentorRole"),
  51010: () => new AppError("errors.passwordNotStored", undefined, "validation"),
  51011: () => new AppError("errors.taskNotFound", undefined, "notFound"),
  51012: () => new AppError("errors.onlyOpenDeletable"),
  51013: () => new AppError("errors.studentOnly"),
  51014: () => new AppError("errors.universityNotFound", undefined, "notFound"),
};

function dbErrorNumber(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as { number?: number; originalError?: { info?: { number?: number } } };
  return e.number ?? e.originalError?.info?.number;
}

export function isUniqueViolation(error: unknown): boolean {
  const n = dbErrorNumber(error);
  return n === 2627 || n === 2601;
}

export function toAppError(error: unknown, uniqueKey: MessageKey = "errors.duplicate"): AppError {
  if (error instanceof AppError) return error;
  const n = dbErrorNumber(error);
  if (n !== undefined && DB_ERRORS[n]) return DB_ERRORS[n]();
  if (isUniqueViolation(error)) return new AppError(uniqueKey, undefined, "conflict");
  logError("unexpected_action_error", error);
  return new AppError("errors.generic");
}

// `values`: non-secret fields echoed back on failure, so the form shows them again after React resets it.
export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; values?: Record<string, string> };

/** Text fields to show again after a failed submission. Never pass password fields. */
export function keptValues(formData: FormData, names: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value.slice(0, 2000);
  }
  return values;
}

export async function runAction<T>(t: Translate, work: () => Promise<T>, uniqueKey?: MessageKey): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    // Next.js uses thrown errors for redirect() and notFound(); let them through.
    if (error && typeof error === "object" && "digest" in error) throw error;
    const appError = toAppError(error, uniqueKey);
    return { ok: false, error: t(appError.key, appError.vars) };
  }
}
