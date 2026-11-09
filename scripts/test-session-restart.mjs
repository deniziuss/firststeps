// Session revocation across a server restart (migration 0004). Uses the existing production build
// (`npm run build` first) and the local FirstSteps_Dev only.
//   1. start the server, register a synthetic student (qa+restart-…@example.invalid) on two "devices"
//   2. copy device A's cookie, sign device A out (SessionVersion + 1)
//   3. stop and start the server again (no in-memory state survives)
//   4. replaying the copied cookie must be rejected; a session issued after the sign-out must still work
// The synthetic student is removed afterwards with the normal test-data cleanup.
// Usage: node --env-file=.env.local scripts/test-session-restart.mjs
import { execFileSync, spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 3300;
const BASE = `http://localhost:${PORT}`;
const startedAt = new Date();

function startServer() {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore" });
  return child;
}
async function waitUntilUp() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/sign-in`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}
async function stop(child) {
  child.kill();
  await new Promise((r) => child.once("exit", r));
}
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
};

let server = startServer();
await waitUntilUp();
const browser = await chromium.launch({ channel: "msedge" });
const email = `qa+restart-${Date.now()}@example.invalid`;
const password = `Restart-${Date.now()}-pass`;
try {
  const a = await browser.newContext({ baseURL: BASE });
  const pageA = await a.newPage();
  await pageA.goto("/register", { waitUntil: "networkidle" });
  await pageA.getByLabel("First name").fill("Rex");
  await pageA.getByLabel("Last name").fill("Restart");
  await pageA.getByLabel("Email").fill(email);
  await pageA.getByLabel("Password", { exact: true }).fill(password);
  await pageA.getByLabel("Confirm password").fill(password);
  await pageA.getByRole("button", { name: "Create account" }).click();
  await pageA.waitForURL(/\/onboarding$/);
  const stolen = (await a.cookies()).find((c) => c.name === "fs_session");

  await pageA.getByRole("button", { name: "Sign out" }).click();
  await pageA.waitForURL(/\/sign-in$/);

  // Device B signs in after the sign-out: its token carries the new version.
  const b = await browser.newContext({ baseURL: BASE });
  const pageB = await b.newPage();
  await pageB.goto("/sign-in", { waitUntil: "networkidle" });
  await pageB.getByLabel("Email").fill(email);
  await pageB.getByLabel("Password").fill(password);
  await pageB.getByRole("button", { name: "Sign in" }).click();
  await pageB.waitForURL(/\/(dashboard|onboarding)$/);
  const fresh = (await b.cookies()).find((c) => c.name === "fs_session");

  await stop(server);
  server = startServer();
  await waitUntilUp();

  for (const [label, cookie, expectSignedIn] of [
    ["revoked cookie is rejected after a restart", stolen, false],
    ["a session issued after sign-out still works after a restart", fresh, true],
  ]) {
    const context = await browser.newContext({ baseURL: BASE });
    await context.addCookies([{ name: cookie.name, value: cookie.value, url: `${BASE}/` }]);
    const page = await context.newPage();
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const signedIn = !/\/sign-in$/.test(page.url());
    check(label, signedIn === expectSignedIn);
    await context.close();
  }
} finally {
  await browser.close();
  await stop(server);
  execFileSync(process.execPath, ["--env-file=.env.local", "scripts/db/cleanup-test-data.mjs", "--apply", `--since=${startedAt.toISOString()}`], { stdio: "inherit" });
}
