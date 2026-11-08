// Errors that are safe to show to the user. Anything else is logged and replaced by a generic message.
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: "validation" | "conflict" | "forbidden" | "notFound" | "rule" = "rule",
  ) {
    super(message);
    this.name = "AppError";
  }
}

const DB_MESSAGES: Record<number, AppError> = {
  51001: new AppError("Complete the prerequisite tasks first."),
  51002: new AppError("Only active mentors or admins can be assigned to a help request."),
  51010: new AppError("Password could not be stored.", "validation"),
  51011: new AppError("Task not found.", "notFound"),
  51012: new AppError("Only an open, unassigned help request can be deleted."),
  51013: new AppError("Only active student accounts can create a journey."),
  51014: new AppError("University not found.", "notFound"),
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

export function toAppError(error: unknown, uniqueMessage = "This record already exists."): AppError {
  if (error instanceof AppError) return error;
  const n = dbErrorNumber(error);
  if (n !== undefined && DB_MESSAGES[n]) return DB_MESSAGES[n];
  if (isUniqueViolation(error)) return new AppError(uniqueMessage, "conflict");
  console.error(error);
  return new AppError("Something went wrong. Please try again.");
}

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runAction<T>(work: () => Promise<T>, uniqueMessage?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    // Next.js uses thrown errors for redirect() and notFound(); let them through.
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { ok: false, error: toAppError(error, uniqueMessage).message };
  }
}
