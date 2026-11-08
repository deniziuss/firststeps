import { execFileSync } from "node:child_process";

// Records when the run started; the returned teardown removes the synthetic users, journeys,
// help requests and deactivated "E2E …" templates created since then, so local runs do not pile up data.
// The cleanup only ever matches test accounts (see scripts/db/cleanup-test-data.mjs).
// Set E2E_KEEP_DATA=1 to keep the records for debugging.
export default async function globalSetup() {
  const startedAt = new Date(Date.now() - 60_000); // small margin for clock rounding
  return async () => {
    if (process.env.E2E_KEEP_DATA === "1") return;
    execFileSync(process.execPath, ["--env-file=.env.local", "scripts/db/cleanup-test-data.mjs", "--apply", `--since=${startedAt.toISOString()}`], {
      stdio: "inherit",
    });
  };
}
