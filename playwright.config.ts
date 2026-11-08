import { defineConfig } from "@playwright/test";

// Tests run against the local dev server and FirstSteps_Dev only. Credentials come from .env.local.
process.loadEnvFile(".env.local");

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
  // A production build on its own port, so tests do not depend on dev-mode compilation.
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
