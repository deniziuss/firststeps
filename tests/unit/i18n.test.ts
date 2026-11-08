import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { createTranslator } from "@/i18n/translator";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(full, value);
    else for (const [k, v] of leaves(value, full)) result.set(k, v);
  }
  return result;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translation dictionaries", () => {
  const english = leaves(en as unknown as Tree);
  const turkish = leaves(tr as unknown as Tree);

  it("have exactly the same keys", () => {
    expect([...turkish.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("have no empty messages", () => {
    for (const [key, value] of [...english, ...turkish]) expect(value.trim(), key).not.toBe("");
  });

  it("use the same placeholders in both languages", () => {
    for (const [key, value] of english) expect(placeholders(turkish.get(key) ?? ""), key).toEqual(placeholders(value));
  });

  it("translate every message except names and placeholder-only templates", () => {
    const allowedSame = ["common.appName", "roles.Mentor", "admin.requests.mentor", "task.location", "admin.requests.meta"];
    const same = [...english].filter(([key, value]) => turkish.get(key) === value).map(([key]) => key);
    expect(same.sort()).toEqual(allowedSame.sort());
  });
});

describe("translator", () => {
  const { t, format } = createTranslator("tr", tr, en);

  it("interpolates and formats numbers with the locale", () => {
    expect(t("dashboard.progressText", { done: 1, count: 1200 })).toBe("1.200 görevden 1 tanesi tamamlandı");
  });

  it("chooses English plural forms", () => {
    const english = createTranslator("en", en);
    expect(english.t("dashboard.daysToArrival", { count: 1 })).toBe("1 day until arrival");
    expect(english.t("dashboard.daysToArrival", { count: 5 })).toBe("5 days until arrival");
  });

  it("formats dates in UTC with the locale", () => {
    expect(format.date(new Date("2027-02-01T00:00:00Z"))).toBe("1 Şub 2027");
  });
});

// Every t("...") key used in the source exists in the English dictionary (TypeScript checks the
// typed calls; this also catches keys built in templates such as t(`stages.${stage}`)).
describe("keys used in source code", () => {
  const english = leaves(en as unknown as Tree);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && !full.includes(`${path.sep}messages${path.sep}`)) files.push(full);
    }
  };
  walk(path.resolve("src"));

  it("exist in the dictionary", () => {
    const missing: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
        const key = match[1];
        const prefixOfPlural = english.has(`${key}.one`) && english.has(`${key}.other`);
        if (!english.has(key) && !prefixOfPlural) missing.push(`${path.relative(process.cwd(), file)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
