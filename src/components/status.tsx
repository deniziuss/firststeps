import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon, LockIcon, OctagonAlertIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldQuestionIcon, SlashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, type RequestStatus, type SourceStatus, type TaskStatus } from "@/domain/statuses";
import { cn } from "@/lib/utils";

const TASK_STYLES: Record<TaskStatus, { className: string; icon: typeof CircleDotIcon }> = {
  Pending: { className: "bg-secondary text-secondary-foreground", icon: CircleDashedIcon },
  InProgress: { className: "bg-chart-2/15 text-chart-2", icon: CircleDotIcon },
  Blocked: { className: "bg-warning/15 text-warning", icon: OctagonAlertIcon },
  Completed: { className: "bg-success/15 text-success", icon: CircleCheckIcon },
  NotApplicable: { className: "bg-muted text-muted-foreground", icon: SlashIcon },
};

export function TaskStatusBadge({ status, locked = false }: { status: TaskStatus; locked?: boolean }) {
  if (locked && status !== "Completed" && status !== "NotApplicable") {
    return (
      <Badge className="bg-muted text-muted-foreground">
        <LockIcon /> Locked
      </Badge>
    );
  }
  const { className, icon: Icon } = TASK_STYLES[status];
  return (
    <Badge className={className}>
      <Icon /> {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

const SOURCE_STYLES: Record<SourceStatus, { label: string; className: string; icon: typeof ShieldCheckIcon }> = {
  Verified: { label: "Verified", className: "bg-success/15 text-success", icon: ShieldCheckIcon },
  PendingReview: { label: "Review pending", className: "bg-warning/15 text-warning", icon: ShieldQuestionIcon },
  Outdated: { label: "Outdated", className: "bg-destructive/10 text-destructive", icon: ShieldAlertIcon },
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const { label, className, icon: Icon } = SOURCE_STYLES[status];
  return (
    <Badge className={className}>
      <Icon /> {label}
    </Badge>
  );
}

const REQUEST_STYLES: Record<RequestStatus, string> = {
  Open: "bg-warning/15 text-warning",
  Assigned: "bg-chart-2/15 text-chart-2",
  Resolved: "bg-success/15 text-success",
  Closed: "bg-muted text-muted-foreground",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge className={cn(REQUEST_STYLES[status])}>{status}</Badge>;
}
