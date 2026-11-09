import { describe, expect, it } from "vitest";
import { clientAddress } from "@/server/client-ip";

describe("clientAddress", () => {
  it("ignores X-Forwarded-For unless a trusted proxy is configured", () => {
    expect(clientAddress("203.0.113.9", {})).toBeUndefined();
    expect(clientAddress("203.0.113.9", { TRUST_PROXY: "false" })).toBeUndefined();
  });
  it("reads the entry added by the trusted proxy, not one the client sent", () => {
    // The client forged "1.2.3.4"; the proxy appended the real address.
    expect(clientAddress("1.2.3.4, 198.51.100.7", { TRUST_PROXY: "true" })).toBe("198.51.100.7");
    expect(clientAddress("1.2.3.4, 198.51.100.7, 10.0.0.2", { TRUST_PROXY: "true", TRUST_PROXY_HOPS: "2" })).toBe("198.51.100.7");
    expect(clientAddress("2001:db8::1", { TRUST_PROXY: "true" })).toBe("2001:db8::1");
  });
  it("rejects values that are not addresses", () => {
    expect(clientAddress("x:y:email@a", { TRUST_PROXY: "true" })).toBeUndefined();
    expect(clientAddress("", { TRUST_PROXY: "true" })).toBeUndefined();
  });
});
