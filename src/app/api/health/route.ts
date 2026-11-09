// Liveness: the process is up and can answer. No database access, no details.
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
