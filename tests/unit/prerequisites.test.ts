import { describe, expect, it } from "vitest";
import { checkTransition, unmetPrerequisites, type Dependency } from "@/domain/prerequisites";

// 2 requires 1, 3 requires 2
const deps: Dependency[] = [
  { taskId: 2, requiredTaskId: 1 },
  { taskId: 3, requiredTaskId: 2 },
];

describe("unmetPrerequisites", () => {
  it("reports an open prerequisite", () => {
    const tasks = [{ taskId: 1, status: "Pending" as const }, { taskId: 2, status: "Pending" as const }];
    expect(unmetPrerequisites(2, tasks, deps)).toEqual([{ requiredTaskId: 1, reason: "open" }]);
  });

  it("is satisfied when the prerequisite is completed", () => {
    const tasks = [{ taskId: 1, status: "Completed" as const }, { taskId: 2, status: "Pending" as const }];
    expect(unmetPrerequisites(2, tasks, deps)).toEqual([]);
  });

  it("matches the DB trigger: a missing prerequisite blocks", () => {
    const tasks = [{ taskId: 2, status: "Pending" as const }];
    expect(unmetPrerequisites(2, tasks, deps)).toEqual([{ requiredTaskId: 1, reason: "missing" }]);
  });

  it("treats a NotApplicable prerequisite as satisfied (migration 0003)", () => {
    const tasks = [{ taskId: 1, status: "NotApplicable" as const }, { taskId: 2, status: "Pending" as const }];
    expect(unmetPrerequisites(2, tasks, deps)).toEqual([]);
  });

  it("separates a prerequisite that does not apply (satisfied) from a data gap (blocks)", () => {
    const tasks = [{ taskId: 2, status: "Pending" as const }];
    expect(unmetPrerequisites(2, tasks, deps, () => false)).toEqual([]);
    expect(unmetPrerequisites(2, tasks, deps, () => true)).toEqual([{ requiredTaskId: 1, reason: "missing" }]);
    // Without applicability information an absent prerequisite stays blocking (safe default).
    expect(unmetPrerequisites(2, tasks, deps)).toEqual([{ requiredTaskId: 1, reason: "missing" }]);
  });

  it("lets checkTransition complete a task whose only prerequisite does not apply", () => {
    const tasks = [{ taskId: 2, status: "Pending" as const }];
    expect(checkTransition(2, "Pending", "Completed", tasks, deps, () => false)).toEqual({ ok: true });
    expect(checkTransition(2, "Pending", "Completed", tasks, deps, () => true).ok).toBe(false);
  });

  it("does not count a prerequisite in progress", () => {
    const tasks = [{ taskId: 1, status: "InProgress" as const }, { taskId: 2, status: "Pending" as const }];
    expect(unmetPrerequisites(2, tasks, deps)[0].reason).toBe("open");
  });
});

describe("checkTransition", () => {
  it("denies completing before the prerequisite", () => {
    const tasks = [{ taskId: 1, status: "Pending" as const }, { taskId: 2, status: "Pending" as const }];
    expect(checkTransition(2, "Pending", "Completed", tasks, deps)).toMatchObject({ ok: false, code: "prerequisites" });
  });

  it("allows completing after the prerequisite", () => {
    const tasks = [{ taskId: 1, status: "Completed" as const }, { taskId: 2, status: "InProgress" as const }];
    expect(checkTransition(2, "InProgress", "Completed", tasks, deps)).toEqual({ ok: true });
  });

  it("denies reopening a task while a completed dependent exists", () => {
    const tasks = [{ taskId: 1, status: "Completed" as const }, { taskId: 2, status: "Completed" as const }];
    expect(checkTransition(1, "Completed", "Pending", tasks, deps)).toEqual({ ok: false, code: "dependents", dependentTaskIds: [2] });
  });

  it("allows reopening when no dependent is completed", () => {
    const tasks = [{ taskId: 1, status: "Completed" as const }, { taskId: 2, status: "Pending" as const }];
    expect(checkTransition(1, "Completed", "Pending", tasks, deps)).toEqual({ ok: true });
  });

  it("allows non-completion changes regardless of prerequisites", () => {
    const tasks = [{ taskId: 1, status: "Pending" as const }, { taskId: 2, status: "Pending" as const }];
    expect(checkTransition(2, "Pending", "InProgress", tasks, deps)).toEqual({ ok: true });
  });
});
