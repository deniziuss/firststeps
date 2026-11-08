import { describe, expect, it } from "vitest";
import { applicabilityGaps, findCycle } from "@/domain/dependencyGraph";

// 2 requires 1, 3 requires 2
const deps = [
  { taskId: 2, requiredTaskId: 1 },
  { taskId: 3, requiredTaskId: 2 },
];

describe("findCycle", () => {
  it("detects a self dependency", () => {
    expect(findCycle(deps, 4, 4)).toEqual([4]);
  });

  it("detects a direct cycle", () => {
    expect(findCycle(deps, 1, 2)).toEqual([2, 1]);
  });

  it("detects a longer cycle and returns its path", () => {
    expect(findCycle(deps, 1, 3)).toEqual([3, 2, 1]);
  });

  it("accepts a safe edge", () => {
    expect(findCycle(deps, 3, 1)).toBeNull();
    expect(findCycle(deps, 4, 3)).toBeNull();
  });
});

describe("applicabilityGaps", () => {
  const any = { universityId: 1, applicableProgram: "All" as const, accommodationCondition: "Any" as const };

  it("is empty when the prerequisite applies wherever the dependent does", () => {
    expect(applicabilityGaps(any, { ...any, universityId: null })).toEqual([]);
  });

  it("flags a narrower program or accommodation condition", () => {
    const gaps = applicabilityGaps(any, { ...any, applicableProgram: "Erasmus", accommodationCondition: "NotArranged" });
    expect(gaps).toEqual([
      { kind: "programme", value: "Erasmus" },
      { kind: "accommodation", value: "NotArranged" },
    ]);
  });

  it("flags a prerequisite from another university", () => {
    expect(applicabilityGaps(any, { ...any, universityId: 2 })).toEqual([{ kind: "scope" }]);
  });

  it("accepts the same narrow condition on both tasks", () => {
    const erasmus = { ...any, applicableProgram: "Erasmus" as const };
    expect(applicabilityGaps(erasmus, erasmus)).toEqual([]);
  });
});
