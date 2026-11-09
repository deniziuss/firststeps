// Client address for rate limiting. X-Forwarded-For is a list that every proxy appends to, and the
// client can pre-fill it with anything. Only the entries added by our own proxies are trustworthy,
// so the address is read from the right: with TRUST_PROXY_HOPS trusted proxies in front of the app,
// the client is the entry that many places from the end. Without TRUST_PROXY=true the header is
// ignored entirely (all clients share one key, see docs/security.md SEC-06).
export function clientAddress(forwardedFor: string | null | undefined, env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.TRUST_PROXY !== "true" || !forwardedFor) return undefined;
  const hops = Math.max(1, Math.min(5, Number.parseInt(env.TRUST_PROXY_HOPS ?? "1", 10) || 1));
  const entries = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
  const candidate = entries[entries.length - hops];
  // Accept only plain IPv4/IPv6 text, so a forged value cannot inject separators into the key.
  return candidate && /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : undefined;
}
