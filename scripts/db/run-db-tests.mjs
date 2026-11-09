// Runs the database-backed unit tests (SQL trigger parity) against FirstSteps_Dev (default) or, with
// DB_NAME=FirstSteps_Test, the disposable test database (local copy or CI container). Every SQL case runs
// in its own transaction that is rolled back. Needs sqlcmd (Windows auth locally, SQLCMD_USER in CI).
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/unit/prerequisite-parity.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, RUN_DB_TESTS: "1" },
});
process.exit(result.status ?? 1);
