import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { TaskStatusBadge } from "@/components/status";
import { JOURNEY_STAGES, STAGE_LABELS } from "@/domain/statuses";
import type { JourneyTaskView } from "@/server/repositories/tasks";

export function lockSummary(task: JourneyTaskView) {
  if (task.unmet.length === 0) return null;
  const unavailable = task.unmet.filter((u) => u.reason !== "open");
  if (unavailable.length > 0) return "Waiting for a task that is not part of your plan. Ask a mentor for help.";
  return `Requires: ${task.unmet.map((u) => u.title).join(", ")}`;
}

export function TaskList({ tasks }: { tasks: JourneyTaskView[] }) {
  return (
    <div className="grid gap-6">
      {JOURNEY_STAGES.map((stage) => {
        const stageTasks = tasks.filter((t) => t.JourneyStage === stage);
        if (stageTasks.length === 0) return null;
        const done = stageTasks.filter((t) => t.TaskStatus === "Completed").length;
        const applicable = stageTasks.filter((t) => t.TaskStatus !== "NotApplicable").length;
        return (
          <section key={stage} aria-labelledby={`stage-${stage}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 id={`stage-${stage}`} className="font-semibold">
                {STAGE_LABELS[stage]}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {done}/{applicable} done
              </span>
            </div>
            <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              {stageTasks.map((task) => {
                const lock = lockSummary(task);
                return (
                  <li key={task.JourneyTaskID}>
                    <Link
                      href={`/tasks/${task.JourneyTaskID}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={task.TaskStatus === "NotApplicable" ? "text-muted-foreground line-through" : "font-medium"}>{task.TaskTitle}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.Category}
                          {lock && <> · {lock}</>}
                        </p>
                      </div>
                      <TaskStatusBadge status={task.TaskStatus} locked={lock !== null} />
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
