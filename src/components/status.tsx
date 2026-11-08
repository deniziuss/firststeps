import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon, LockIcon, OctagonAlertIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldQuestionIcon, SlashIcon } from "lucide-react";
import type { RequestStatus, SourceStatus, TaskStatus } from "@/domain/statuses";
import type { I18n } from "@/i18n/translator";
import { cn } from "@/lib/utils";

// Statuses are never shown by colour alone: every badge has an icon and a text label.
export type DisplayStatus = TaskStatus | "Locked";

const TASK_STYLES: Record<DisplayStatus, { className: string; icon: typeof CircleDotIcon }> = {
  Pending: { className: "border-input bg-card text-foreground", icon: CircleDashedIcon },
  InProgress: { className: "border-gold/50 bg-gold-soft text-foreground [&>svg]:text-gold", icon: CircleDotIcon },
  Blocked: { className: "border-destructive/40 bg-destructive-soft text-destructive", icon: OctagonAlertIcon },
  Completed: { className: "border-success/30 bg-success-soft text-success", icon: CircleCheckIcon },
  NotApplicable: { className: "border-border bg-muted text-muted-foreground", icon: SlashIcon },
  Locked: { className: "border-border bg-muted text-muted-foreground", icon: LockIcon },
};

const badgeBase = "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5";

export function displayStatus(status: TaskStatus, locked: boolean): DisplayStatus {
  return locked && status !== "Completed" && status !== "NotApplicable" ? "Locked" : status;
}

export function TaskStatusBadge({ status, i18n }: { status: DisplayStatus; i18n: Pick<I18n, "t"> }) {
  const { className, icon: Icon } = TASK_STYLES[status];
  return (
    <span className={cn(badgeBase, className)}>
      <Icon aria-hidden /> {i18n.t(`taskStatus.${status}.label`)}
    </span>
  );
}

export function StatusLegend({ i18n }: { i18n: Pick<I18n, "t"> }) {
  const statuses: DisplayStatus[] = ["Pending", "InProgress", "Locked", "Blocked", "Completed", "NotApplicable"];
  return (
    <details className="group rounded-xl border bg-card px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium">{i18n.t("journey.legendTitle")}</summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {statuses.map((status) => (
          <div key={status} className="grid gap-1">
            <dt>
              <TaskStatusBadge status={status} i18n={i18n} />
            </dt>
            <dd className="text-muted-foreground">{i18n.t(`taskStatus.${status}.description`)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const SOURCE_STYLES: Record<SourceStatus, { className: string; icon: typeof ShieldCheckIcon }> = {
  Verified: { className: "border-success/30 bg-success-soft text-success", icon: ShieldCheckIcon },
  PendingReview: { className: "border-gold/50 bg-gold-soft text-foreground [&>svg]:text-gold", icon: ShieldQuestionIcon },
  Outdated: { className: "border-destructive/40 bg-destructive-soft text-destructive", icon: ShieldAlertIcon },
};

export function SourceStatusBadge({ status, i18n }: { status: SourceStatus; i18n: Pick<I18n, "t"> }) {
  const { className, icon: Icon } = SOURCE_STYLES[status];
  return (
    <span className={cn(badgeBase, className)}>
      <Icon aria-hidden /> {i18n.t(`sourceStatus.${status}.label`)}
    </span>
  );
}

const REQUEST_STYLES: Record<RequestStatus, string> = {
  Open: "border-gold/50 bg-gold-soft text-foreground",
  Assigned: "border-input bg-card text-foreground",
  Resolved: "border-success/30 bg-success-soft text-success",
  Closed: "border-border bg-muted text-muted-foreground",
};

export function RequestStatusBadge({ status, i18n }: { status: RequestStatus; i18n: Pick<I18n, "t"> }) {
  return <span className={cn(badgeBase, REQUEST_STYLES[status])}>{i18n.t(`requestStatus.${status}`)}</span>;
}
