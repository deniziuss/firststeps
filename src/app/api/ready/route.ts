import { checkReadiness } from "@/server/health";

// Readiness: the app can serve requests (configuration valid, database reachable within 3 s,
// security tables present). 200 when ready, 503 otherwise. The body only says which check failed,
// never error messages, versions or host names.
export async function GET() {
  const result = await checkReadiness();
  return Response.json(result, { status: result.status === "ready" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
