import "server-only";

// Fixed-window limiter kept in memory. Enough for a single-process deployment.
const windows = new Map<string, { count: number; resetAt: number }>();

export function takeToken(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetTokens(key: string) {
  windows.delete(key);
}
