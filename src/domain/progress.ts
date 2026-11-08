import type { TaskStatus } from "./statuses";

export type Progress = {
  total: number; // tasks that apply to the journey (NotApplicable excluded)
  completed: number;
  inProgress: number;
  blocked: number;
  open: number; // Pending
  notApplicable: number;
  percent: number; // whole number, 0 when there are no applicable tasks
};

export function summarizeProgress(statuses: TaskStatus[]): Progress {
  const count = (status: TaskStatus) => statuses.filter((s) => s === status).length;
  const notApplicable = count("NotApplicable");
  const total = statuses.length - notApplicable;
  const completed = count("Completed");
  return {
    total,
    completed,
    inProgress: count("InProgress"),
    blocked: count("Blocked"),
    open: count("Pending"),
    notApplicable,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
