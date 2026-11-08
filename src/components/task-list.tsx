import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { displayStatus, TaskStatusBadge } from "@/components/status";
import { JOURNEY_STAGES } from "@/domain/statuses";
import type { I18n } from "@/i18n/translator";
import { categoryLabel } from "@/lib/content";
import type { JourneyTaskView } from "@/server/repositories/tasks";

export function lockSummary({ t }: Pick<I18n, "t">, task: JourneyTaskView) {
  if (task.unmet.length === 0) return null;
  if (task.unmet.some((u) => u.reason !== "open")) return t("journey.notInPlan");
  return t("journey.requires", { tasks: task.unmet.map((u) => u.title).join(", ") });
}

export function TaskList({ tasks, i18n }: { tasks: JourneyTaskView[]; i18n: I18n }) {
  const { t } = i18n;
  return (
    <div className="grid gap-10">
      {JOURNEY_STAGES.map((stage, index) => {
        const stageTasks = tasks.filter((task) => task.JourneyStage === stage);
        if (stageTasks.length === 0) return null;
        const done = stageTasks.filter((task) => task.TaskStatus === "Completed").length;
        const applicable = stageTasks.filter((task) => task.TaskStatus !== "NotApplicable").length;
        return (
          <section key={stage} aria-labelledby={`stage-${stage}`} className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-taupe/40 pb-2">
              <h2 id={`stage-${stage}`} className="text-xl font-semibold">
                <span className="mr-2 font-heading text-gold" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {t(`stages.${stage}`)}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">{t("journey.stageDone", { done, count: applicable })}</span>
            </div>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {stageTasks.map((task) => {
                const lock = lockSummary(i18n, task);
                const status = displayStatus(task.TaskStatus, lock !== null);
                return (
                  <li key={task.JourneyTaskID}>
                    <Link href={`/tasks/${task.JourneyTaskID}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className={task.TaskStatus === "NotApplicable" ? "text-muted-foreground line-through" : "font-medium"}>{task.TaskTitle}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {categoryLabel(i18n, task.Category)}
                          {lock && <> · {lock}</>}
                        </p>
                      </div>
                      <TaskStatusBadge status={status} i18n={i18n} />
                      <ChevronRightIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
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
