import { isTemplateApplicable, type JourneyProfile, type TemplateRule } from "./journeyEngine";
import type { TaskStatus } from "./statuses";

export type ExistingJourneyTask = { journeyTaskId: number; taskId: number; status: TaskStatus };

export type ReconcilePlan = {
  add: number[]; // template ids to insert as Pending
  markNotApplicable: number[]; // journey task ids
  reopen: number[]; // journey task ids: NotApplicable -> Pending
};

// Re-evaluates a journey after its profile changed. Rows are never deleted and completed tasks are
// never touched, so completion history survives every change.
export function planReconciliation(templates: TemplateRule[], existing: ExistingJourneyTask[], profile: JourneyProfile): ReconcilePlan {
  const applicable = new Set(templates.filter((t) => isTemplateApplicable(t, profile)).map((t) => t.taskId));
  const present = new Set(existing.map((t) => t.taskId));

  return {
    add: [...applicable].filter((taskId) => !present.has(taskId)),
    markNotApplicable: existing
      .filter((t) => !applicable.has(t.taskId) && t.status !== "Completed" && t.status !== "NotApplicable")
      .map((t) => t.journeyTaskId),
    reopen: existing.filter((t) => applicable.has(t.taskId) && t.status === "NotApplicable").map((t) => t.journeyTaskId),
  };
}
