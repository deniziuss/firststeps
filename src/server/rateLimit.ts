import "server-only";

// Fixed-window limiter kept in memory (shared by all server bundles of the process). Enough for the
// single-process local deployment; a multi-instance deployment needs a shared store (docs/security.md).
const store = globalThis as typeof globalThis & { __fsRateWindows?: Map<string, { count: number; resetAt: number }> };
const windows = (store.__fsRateWindows ??= new Map());

function prune(now: number) {
  if (windows.size < 5000) return;
  for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
}

export function takeToken(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);
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
