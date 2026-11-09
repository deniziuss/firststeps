import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every server action can be called directly with any form data, so each exported action must check
// the session itself before doing anything. This guards against a new action that forgets it.
const PUBLIC_ACTIONS = new Set(["auth.ts:register", "auth.ts:signIn", "auth.ts:signOut"]);
const dir = path.resolve("src/server/actions");

describe("server actions", () => {
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
    const text = readFileSync(path.join(dir, file), "utf8");
    it(`${file} starts with "use server"`, () => expect(text.trimStart().startsWith('"use server"')).toBe(true));
    for (const match of text.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/g)) {
      const [, name, body] = match;
      if (PUBLIC_ACTIONS.has(`${file}:${name}`)) continue;
      it(`${file}: ${name} requires a signed-in user with the right role first`, () => {
        const firstLine = body.split("\n").find((line) => line.trim() !== "")!;
        expect(firstLine).toMatch(/await require(Role|User)\(/);
        if (file === "admin.ts") expect(firstLine).toContain('requireRole("Admin")');
        if (file === "student.ts") expect(firstLine).toContain('requireRole("Student")');
      });
    }
  }
});

describe("safeHref", async () => {
  const { safeHref } = await import("@/lib/safe-url");
  it("keeps http and https links", () => {
    expect(safeHref("https://www.rtu.lv/")).toBe("https://www.rtu.lv/");
    expect(safeHref("http://example.lv/a?b=1")).toBe("http://example.lv/a?b=1");
  });
  it("drops scripts, data and relative values", () => {
    for (const value of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,hi", "vbscript:x", "/relative", "", null, undefined]) {
      expect(safeHref(value)).toBeUndefined();
    }
  });
});

describe("URL validation", async () => {
  const { universitySchema } = await import("@/lib/validation");
  const base = { universityName: "Test", city: "Liepāja", country: "Latvia", countryCode: "LV" };
  it("accepts only http(s) links", () => {
    expect(universitySchema.safeParse({ ...base, website: "https://www.liepaja.lv" }).success).toBe(true);
    expect(universitySchema.safeParse({ ...base, website: "" }).success).toBe(true);
    for (const website of ["javascript:alert(1)", "data:text/html,hi", "ftp://x.lv"]) {
      expect(universitySchema.safeParse({ ...base, website }).success, website).toBe(false);
    }
  });
});
