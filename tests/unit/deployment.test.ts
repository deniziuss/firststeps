import { describe, expect, it } from "vitest";
import { publicRequestCheck } from "@/lib/deployment";

const base = { deployment: "public", appUrl: "https://firststeps.example", trustProxy: "true", host: "firststeps.example", forwardedProto: "https", pathWithQuery: "/sign-in?x=1" };

describe("public request checks", () => {
  it("does nothing outside a public deployment", () => {
    expect(publicRequestCheck({ ...base, deployment: "local", host: "localhost:3000", forwardedProto: "http" })).toEqual({ action: "ok" });
    expect(publicRequestCheck({ ...base, deployment: undefined, host: "anything" })).toEqual({ action: "ok" });
  });
  it("serves the configured host over HTTPS", () => expect(publicRequestCheck(base)).toEqual({ action: "ok" }));
  it("rejects other Host headers", () => {
    expect(publicRequestCheck({ ...base, host: "evil.example" })).toEqual({ action: "reject", status: 421 });
    expect(publicRequestCheck({ ...base, host: null })).toEqual({ action: "reject", status: 421 });
  });
  it("redirects plain http to the same path on APP_URL", () => {
    expect(publicRequestCheck({ ...base, forwardedProto: "http" })).toEqual({ action: "redirect", location: "https://firststeps.example/sign-in?x=1" });
  });
  it("ignores X-Forwarded-Proto unless a trusted proxy is configured", () => {
    expect(publicRequestCheck({ ...base, trustProxy: "false", forwardedProto: "http" })).toEqual({ action: "ok" });
  });
  it("never redirects to a host taken from the request", () => {
    const result = publicRequestCheck({ ...base, forwardedProto: "http", pathWithQuery: "//evil.example/x" });
    expect(result.action === "redirect" && new URL(result.location).host).toBe("firststeps.example");
  });
});
