import type { TaskStatus } from "./statuses";

export type Dependency = { taskId: number; requiredTaskId: number };
export type JourneyTaskState = { taskId: number; status: TaskStatus };

export type UnmetPrerequisite = {
  requiredTaskId: number;
  // "open": still to do in this journey.
  // "notApplicable": does not apply to this journey (NotApplicable row, or a template that does not
  //   match the journey profile). Under the current DB trigger the dependent task stays locked (Issue 001).
  // "missing": applies to the journey but has no journey task (a data gap, e.g. a template added
  //   after the journey was created). Re-planning the journey adds it.
  reason: "open" | "notApplicable" | "missing";
};

// Mirrors dbo.trg_JourneyTasks_ValidatePrerequisites: every prerequisite must exist in the same
// journey with status Completed. `appliesToJourney` only refines the reason for a prerequisite
// without a journey task; without it such a prerequisite is reported as "missing".
export function unmetPrerequisites(
  taskId: number,
  journeyTasks: JourneyTaskState[],
  dependencies: Dependency[],
  appliesToJourney?: (taskId: number) => boolean,
): UnmetPrerequisite[] {
  const statusByTask = new Map(journeyTasks.map((t) => [t.taskId, t.status]));
  return dependencies
    .filter((d) => d.taskId === taskId)
    .flatMap((d): UnmetPrerequisite[] => {
      const status = statusByTask.get(d.requiredTaskId);
      if (status === "Completed") return [];
      if (status === undefined) {
        const reason = appliesToJourney && !appliesToJourney(d.requiredTaskId) ? "notApplicable" : "missing";
        return [{ requiredTaskId: d.requiredTaskId, reason }];
      }
      if (status === "NotApplicable") return [{ requiredTaskId: d.requiredTaskId, reason: "notApplicable" }];
      return [{ requiredTaskId: d.requiredTaskId, reason: "open" }];
    });
}

// A completed task cannot be reopened while a task that depends on it is still completed,
// otherwise the journey would show a completion whose prerequisite is not done.
export function completedDependents(taskId: number, journeyTasks: JourneyTaskState[], dependencies: Dependency[]): number[] {
  const completed = new Set(journeyTasks.filter((t) => t.status === "Completed").map((t) => t.taskId));
  return dependencies.filter((d) => d.requiredTaskId === taskId && completed.has(d.taskId)).map((d) => d.taskId);
}

export type TransitionCheck = { ok: true } | { ok: false; code: "prerequisites"; unmet: UnmetPrerequisite[] } | { ok: false; code: "dependents"; dependentTaskIds: number[] };

export function checkTransition(
  taskId: number,
  from: TaskStatus,
  to: TaskStatus,
  journeyTasks: JourneyTaskState[],
  dependencies: Dependency[],
): TransitionCheck {
  if (to === "Completed" && from !== "Completed") {
    const unmet = unmetPrerequisites(taskId, journeyTasks, dependencies);
    if (unmet.length > 0) return { ok: false, code: "prerequisites", unmet };
  }
  if (from === "Completed" && to !== "Completed") {
    const dependentTaskIds = completedDependents(taskId, journeyTasks, dependencies);
    if (dependentTaskIds.length > 0) return { ok: false, code: "dependents", dependentTaskIds };
  }
  return { ok: true };
}
