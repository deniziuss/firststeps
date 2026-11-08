import { describe, expect, it } from "vitest";
import type { TemplateRule } from "@/domain/journeyEngine";
import { summarizeProgress } from "@/domain/progress";
import { planReconciliation } from "@/domain/reconcile";

const templates: TemplateRule[] = [
  { taskId: 1, universityId: 1, applicableProgram: "All", accommodationCondition: "Any", isActive: true },
  { taskId: 2, universityId: 1, applicableProgram: "All", accommodationCondition: "NotArranged", isActive: true },
  { taskId: 3, universityId: 1, applicableProgram: "All", accommodationCondition: "Confirmed", isActive: true },
];

describe("planReconciliation", () => {
  it("adds newly applicable tasks and retires open ones when accommodation is confirmed", () => {
    const existing = [
      { journeyTaskId: 10, taskId: 1, status: "Completed" as const },
      { journeyTaskId: 11, taskId: 2, status: "InProgress" as const },
    ];
    const plan = planReconciliation(templates, existing, { universityId: 1, programType: "Erasmus", accommodationStatus: "Confirmed" });
    expect(plan).toEqual({ add: [3], markNotApplicable: [11], reopen: [] });
  });

  it("keeps completed tasks even when they no longer apply", () => {
    const existing = [{ journeyTaskId: 11, taskId: 2, status: "Completed" as const }];
    const plan = planReconciliation(templates, existing, { universityId: 1, programType: "Erasmus", accommodationStatus: "Confirmed" });
    expect(plan.markNotApplicable).toEqual([]);
  });

  it("reopens a retired task when it applies again, without duplicating it", () => {
    const existing = [
      { journeyTaskId: 10, taskId: 1, status: "Pending" as const },
      { journeyTaskId: 11, taskId: 2, status: "NotApplicable" as const },
      { journeyTaskId: 12, taskId: 3, status: "Pending" as const },
    ];
    const plan = planReconciliation(templates, existing, { universityId: 1, programType: "Erasmus", accommodationStatus: "NotArranged" });
    expect(plan).toEqual({ add: [], markNotApplicable: [12], reopen: [11] });
  });
});

describe("summarizeProgress", () => {
  it("excludes NotApplicable tasks from the percentage", () => {
    const progress = summarizeProgress(["Completed", "Pending", "NotApplicable", "Blocked"]);
    expect(progress).toMatchObject({ total: 3, completed: 1, blocked: 1, open: 1, notApplicable: 1, percent: 33 });
  });

  it("returns 0 percent for an empty journey", () => {
    expect(summarizeProgress([]).percent).toBe(0);
  });
});
