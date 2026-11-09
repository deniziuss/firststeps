import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { displayStatus, TaskStatusBadge } from "@/components/status";
import { JOURNEY_STAGES } from "@/domain/statuses";
import type { I18n } from "@/i18n/translator";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/content";
import type { JourneyTaskView } from "@/server/repositories/tasks";

export function lockSummary({ t }: Pick<I18n, "t">, task: JourneyTaskView) {
  if (task.unmet.length === 0) return null;
  if (task.unmet.some((u) => u.reason === "missing")) return t("journey.missingFromPlan");
  return t("journey.requires", { tasks: task.unmet.map((u) => u.title).join(", ") });
}

export function TaskList({ tasks, i18n }: { tasks: JourneyTaskView[]; i18n: I18n }) {
  const { t } = i18n;
  return (
    // A vertical journey timeline: each stage is a station on the rail, filled when the stage is complete.
    <div className="relative grid gap-12">
      <span aria-hidden className="absolute top-3 bottom-3 left-[0.6875rem] w-px bg-hairline" />
      {JOURNEY_STAGES.map((stage, index) => {
        const stageTasks = tasks.filter((task) => task.JourneyStage === stage);
        if (stageTasks.length === 0) return null;
        const done = stageTasks.filter((task) => task.TaskStatus === "Completed").length;
        const applicable = stageTasks.filter((task) => task.TaskStatus !== "NotApplicable").length;
        return (
          <section key={stage} aria-labelledby={`stage-${stage}`} className="relative grid gap-4 pl-10 sm:pl-12">
            <span
              aria-hidden
              className={cn(
                "absolute top-1.5 left-0 grid size-[1.375rem] place-items-center rounded-full border bg-background",
                applicable > 0 && done === applicable ? "border-ochre bg-ochre" : done > 0 ? "border-ochre" : "border-taupe",
              )}
            >
              <span className={cn("size-2 rounded-full", applicable > 0 && done === applicable ? "bg-background" : done > 0 ? "bg-ochre" : "bg-transparent")} />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`stage-${stage}`} className="text-2xl font-light tracking-[-0.02em]">
                <span className="mr-3 font-mono text-sm text-gold" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {t(`stages.${stage}`)}
              </h2>
              <span className="flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
                <span aria-hidden className="hidden h-1 w-20 overflow-hidden rounded-full bg-band-strong sm:block">
                  <span className="block h-full bg-ochre" style={{ width: `${applicable ? (done / applicable) * 100 : 0}%` }} />
                </span>
                {t("journey.stageDone", { done, count: applicable })}
              </span>
            </div>
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {stageTasks.map((task) => {
                const lock = lockSummary(i18n, task);
                const status = displayStatus(task.TaskStatus, lock !== null);
                return (
                  <li key={task.JourneyTaskID}>
                    <Link href={`/tasks/${task.JourneyTaskID}`} className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-band sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className={task.TaskStatus === "NotApplicable" ? "text-muted-foreground line-through" : "font-medium"}>{task.TaskTitle}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {categoryLabel(i18n, task.Category)}
                          {lock && <> · {lock}</>}
                        </p>
                      </div>
                      <TaskStatusBadge status={status} i18n={i18n} />
                      <ChevronRightIcon className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
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
