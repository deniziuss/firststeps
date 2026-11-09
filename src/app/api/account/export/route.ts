import { authLimitsExport } from "@/server/authLimits";
import { getCurrentUser } from "@/server/dal";
import { log, logError } from "@/server/log";
import { hit } from "@/server/rateLimit";
import { exportAccountData } from "@/server/repositories/privacy";

// Self-service export of the signed-in user's own data as a JSON download (docs/privacy.md).
// Same session checks as every page (SessionVersion, password fingerprint, active account).
// GET is safe here: it changes nothing except a rate-limit counter, and the response is only readable
// by the same origin (no CORS headers), so another site cannot read the download.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  try {
    if (!(await hit(authLimitsExport(user.id)))) return new Response(null, { status: 429, headers: { "Retry-After": "3600" } });
    const data = await exportAccountData(user.id);
    if (!data) return new Response(null, { status: 404 });
    void log("info", "auth", "data_exported", { userId: user.id });
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="firststeps-account-${user.id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logError("data_export_failed", error, { userId: user.id }, "auth");
    return new Response(null, { status: 503 });
  }
}
