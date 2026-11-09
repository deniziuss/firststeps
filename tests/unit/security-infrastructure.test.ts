import { describe, expect, it } from "vitest";
import { auditDetails } from "@/server/audit";
import { passwordChangeBucket, registerBuckets, resetRequestBuckets, signInBuckets } from "@/server/authLimits";

describe("audit details", () => {
  it("drops secret-looking and personal keys and keeps ids and values", () => {
    const text = auditDetails({ role: "Mentor", active: true, email: "a@b.c", passwordHash: "x", token: "t", sessionVersion: 3, taskId: 7 });
    expect(JSON.parse(text!)).toEqual({ role: "Mentor", active: true, taskId: 7 });
  });
  it("is bounded to the column size", () => {
    expect(auditDetails({ title: "x".repeat(5000) })!.length).toBeLessThanOrEqual(1000);
    expect(auditDetails(undefined)).toBeNull();
  });
});

describe("rate-limit policy", () => {
  it("uses per-client buckets only when the client address is known", () => {
    expect(signInBuckets("a@b.c", undefined).client).toBeUndefined();
    expect(signInBuckets("a@b.c", "198.51.100.7").client?.limit).toBe(30);
    expect(registerBuckets("a@b.c", undefined)).toHaveLength(1);
    expect(resetRequestBuckets("a@b.c", "198.51.100.7")).toHaveLength(2);
  });
  it("makes locking out an account for everyone much harder than guessing from one place", () => {
    const buckets = signInBuckets("a@b.c", "198.51.100.7");
    expect(buckets.account.limit / buckets.pair.limit).toBeGreaterThanOrEqual(10);
    expect(buckets.pair.subject).toContain("198.51.100.7");
  });
  it("keys per user for authenticated operations", () => {
    expect(passwordChangeBucket(42).subject).toBe("42");
  });
});
