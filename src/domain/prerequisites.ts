import type { TaskStatus } from "./statuses";

export type Dependency = { taskId: number; requiredTaskId: number };
export type JourneyTaskState = { taskId: number; status: TaskStatus };

export type UnmetPrerequisite = {
  requiredTaskId: number;
  // "open": the prerequisite is in this journey but not completed yet.
  // "missing": it applies to the journey but has no journey task (a data gap, e.g. a template added
  //   after the journey was created). Re-planning the journey adds it.
  reason: "open" | "missing";
};

// Same rule as dbo.trg_JourneyTasks_ValidatePrerequisites (migration 0003). A prerequisite is satisfied when
//   1. its journey task is Completed, or
//   2. its journey task is NotApplicable, or
//   3. it has no journey task and its template does not apply to this journey.
// It blocks when it has a journey task that is not done ("open"), or when it has none although its
// template applies ("missing"). `appliesToJourney` decides case 3; without it an absent prerequisite
// is treated as missing (the safe default). tests/unit/prerequisite-parity.test.ts checks this
// function and the trigger against the same cases.
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
      if (status === "NotApplicable") return [];
      if (status === undefined) {
        if (appliesToJourney && !appliesToJourney(d.requiredTaskId)) return [];
        return [{ requiredTaskId: d.requiredTaskId, reason: "missing" }];
      }
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
  appliesToJourney?: (taskId: number) => boolean,
): TransitionCheck {
  if (to === "Completed" && from !== "Completed") {
    const unmet = unmetPrerequisites(taskId, journeyTasks, dependencies, appliesToJourney);
    if (unmet.length > 0) return { ok: false, code: "prerequisites", unmet };
  }
  if (from === "Completed" && to !== "Completed") {
    const dependentTaskIds = completedDependents(taskId, journeyTasks, dependencies);
    if (dependentTaskIds.length > 0) return { ok: false, code: "dependents", dependentTaskIds };
  }
  return { ok: true };
}
