// Request checks for a public deployment (DEPLOYMENT=public), used by the proxy. Pure, so they are
// unit-tested. Local development and the local production build (DEPLOYMENT=local) are not affected.
//
// - Host: only the host of APP_URL is served. Requests for any other Host header are rejected, so a
//   forged Host cannot reach the app (cache poisoning, host-header tricks); links in emails are
//   always built from APP_URL anyway.
// - HTTPS: behind the trusted reverse proxy, X-Forwarded-Proto says how the client connected. Plain
//   http is redirected (308) to the same path on APP_URL. The proxy itself should already redirect;
//   this is the second line of defence.
// X-Forwarded-Proto is only believed when TRUST_PROXY=true (the proxy overwrites it).
export type RequestCheck = { action: "ok" } | { action: "redirect"; location: string } | { action: "reject"; status: 421 | 400 };

export function publicRequestCheck(input: {
  deployment: string | undefined;
  appUrl: string | undefined;
  trustProxy: string | undefined;
  host: string | null;
  forwardedProto: string | null;
  pathWithQuery: string;
}): RequestCheck {
  if (input.deployment !== "public") return { action: "ok" };
  let app: URL;
  try {
    app = new URL(input.appUrl ?? "");
  } catch {
    return { action: "reject", status: 400 };
  }
  const host = (input.host ?? "").toLowerCase();
  if (host !== app.host.toLowerCase()) return { action: "reject", status: 421 };
  const proto = input.trustProxy === "true" ? (input.forwardedProto ?? "").split(",")[0].trim().toLowerCase() : "";
  // The path is appended to APP_URL's origin as text: a path like "//other.host/x" must not be read as
  // a protocol-relative URL (open redirect).
  if (proto === "http") return { action: "redirect", location: `${app.origin}/${input.pathWithQuery.replace(/^[/\\]+/, "")}` };
  return { action: "ok" };
}
