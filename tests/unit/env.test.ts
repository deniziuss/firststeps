import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const base = {
  DB_SERVER: "127.0.0.1",
  DB_NAME: "FirstSteps_Test",
  DB_USER: "firststeps_app",
  DB_PASSWORD: "x",
  SESSION_SECRET: "s".repeat(40),
};
const issues = (source: Record<string, string>) => {
  const result = parseEnv(source);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("server configuration", () => {
  it("accepts the local defaults", () => expect(issues(base)).toEqual([]));

  it("refuses remote database servers and other database names", () => {
    expect(issues({ ...base, DB_SERVER: "school.example.lv" })).toContain("DB_SERVER");
    expect(issues({ ...base, DB_NAME: "26_Nevzat_Enes_SP_FirstSteps" })).toContain("DB_NAME");
  });

  it("requires a long session secret", () => expect(issues({ ...base, SESSION_SECRET: "short" })).toContain("SESSION_SECRET"));

  it("enforces production settings when DEPLOYMENT=public", () => {
    const failed = issues({ ...base, DEPLOYMENT: "public", DB_TRUST_SERVER_CERT: "true" });
    for (const field of ["APP_URL", "MAIL_TRANSPORT", "DB_TRUST_SERVER_CERT", "TRUST_PROXY"]) expect(failed).toContain(field);
    expect(
      issues({
        ...base,
        DEPLOYMENT: "public",
        APP_URL: "https://firststeps.example",
        MAIL_TRANSPORT: "disabled",
        DB_ENCRYPT: "true",
        DB_TRUST_SERVER_CERT: "false",
        TRUST_PROXY: "true",
      }),
    ).toEqual([]);
  });

  it("only accepts http(s) app URLs", () => expect(issues({ ...base, APP_URL: "javascript:alert(1)" })).toContain("APP_URL"));
});
