import { defineConfig } from "@playwright/test";

// Tests run against a local production build. Credentials come from .env.local; variables already set
// in the shell win (process.loadEnvFile does not override), so the suite can target the disposable
// database: DB_NAME=FirstSteps_Test npx playwright test. Emails go to the development outbox, which the
// tests read to follow verification and reset links.
process.loadEnvFile(".env.local");
process.env.APP_URL = "http://localhost:3100";
process.env.MAIL_TRANSPORT = "outbox";
process.env.MAIL_OUTBOX_DIR = ".mail-outbox/e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3100",
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
  globalSetup: "./tests/e2e/global-setup.ts",
  // A production build on its own port, so tests do not depend on dev-mode compilation.
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    // E2E_REUSE_SERVER=1 runs the suite against a server you started yourself (for example with logs
    // written to a file for the log scan); by default the suite builds and starts its own.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
  },
});
