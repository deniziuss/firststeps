import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./i18n/config";
import { publicRequestCheck } from "./lib/deployment";

// URLs stay free of a language prefix (/dashboard). The proxy rewrites each request to the
// [locale] segment chosen by the language cookie, so every page, link and redirect keeps working.
// A prefixed URL (/tr/dashboard) selects that language directly and stores it in the cookie.
//
// Every request also gets a correlation id (x-request-id): taken from a trusted proxy when it is a
// plain UUID-like value, otherwise generated here. Server logs include it, and it is returned in the
// response header so a user-reported problem can be found in the logs.
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Public deployments: only the configured host, only HTTPS (see lib/deployment.ts).
  const check = publicRequestCheck({
    deployment: process.env.DEPLOYMENT,
    appUrl: process.env.APP_URL,
    trustProxy: process.env.TRUST_PROXY,
    host: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    pathWithQuery: pathname + request.nextUrl.search,
  });
  if (check.action === "reject") return new NextResponse(null, { status: check.status });
  if (check.action === "redirect") return NextResponse.redirect(check.location, 308);
  const [, first] = pathname.split("/");
  const incoming = request.headers.get("x-request-id");
  const requestId = process.env.TRUST_PROXY === "true" && incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  let response: NextResponse;
  if (isLocale(first)) {
    response = NextResponse.next({ request: { headers } });
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" });
    }
  } else {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers } });
  }
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // API routes (health checks) are not localized.
  matcher: ["/((?!_next/|api/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
