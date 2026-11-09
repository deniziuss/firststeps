// Runs the database-backed unit tests (SQL trigger parity) against the local FirstSteps_Dev only.
// Every SQL case runs in its own transaction that is rolled back. Needs sqlcmd and Windows auth.
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/unit/prerequisite-parity.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, RUN_DB_TESTS: "1" },
});
process.exit(result.status ?? 1);
