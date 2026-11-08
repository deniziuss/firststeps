import { ArrowLeftIcon, ExternalLinkIcon, InfoIcon, LockIcon, LockOpenIcon, ShieldQuestionIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/components/page";
import { RequestStatusBadge, SourceStatusBadge, TaskStatusBadge } from "@/components/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { getTaskDetail } from "@/server/repositories/tasks";
import { HelpRequestForm, StatusForm } from "./task-forms";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: PageProps<"/tasks/[journeyTaskId]">) {
  const user = await requireRole("Student");
  const journeyTaskId = Number((await params).journeyTaskId);
  const task = Number.isInteger(journeyTaskId) ? await getTaskDetail(user.id, journeyTaskId) : undefined;
  if (!task) notFound();

  const requests = await listStudentRequests(user.id, task.JourneyTaskID);
  const locked = task.unmet.length > 0;
  const unavailable = task.unmet.filter((u) => u.reason !== "open");

  return (
    <div className="grid gap-6">
      <div>
        <Link href={`/journey/${task.JourneyID}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Back to journey
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STAGE_LABELS[task.JourneyStage]}</Badge>
          <Badge variant="outline">{task.Category}</Badge>
          <Badge variant="outline">Priority {task.Priority}</Badge>
          <TaskStatusBadge status={task.TaskStatus} locked={locked} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{task.TaskTitle}</h1>
        {task.CompletedAt && <p className="mt-1 text-sm text-muted-foreground">Completed {formatDateTime(task.CompletedAt)}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>What to do</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-relaxed">
              <p>{task.Description ?? "No guidance text has been added for this task yet."}</p>
              <p className="text-xs text-muted-foreground">
                This is general guidance, not legal advice. Always confirm requirements with the official source.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Official sources</CardTitle>
              <CardDescription>Every source shows when it was last checked by our team.</CardDescription>
            </CardHeader>
            <CardContent>
              {task.sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No source has been linked to this task yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {task.sources.map((source) => (
                    <li key={source.SourceID} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{source.SourceTitle}</p>
                        <SourceStatusBadge status={source.SourceStatus} />
                      </div>
                      {source.SourceURL && (
                        <a
                          href={source.SourceURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 break-all text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {source.SourceURL} <ExternalLinkIcon className="size-3.5 shrink-0" />
                        </a>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {source.SourceStatus === "Verified"
                          ? `Last verified ${formatDate(source.LastVerifiedAt)}`
                          : source.SourceStatus === "Outdated"
                            ? "Marked as outdated. Information may no longer be correct."
                            : "Not yet verified. Check the information on the official website."}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>I&apos;m stuck</CardTitle>
              <CardDescription>Describe the problem. A mentor answers here, usually within a few days.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {requests.length > 0 && (
                <ul className="grid gap-3">
                  {requests.map((request) => (
                    <li key={request.RequestID} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{request.Subject}</p>
                        <RequestStatusBadge status={request.RequestStatus} />
                      </div>
                      <p className="mt-1 text-muted-foreground">{request.ProblemDescription}</p>
                      {request.ResolutionText && (
                        <div className="mt-2 rounded-md bg-accent p-2 text-accent-foreground">
                          <p className="text-xs font-medium">Answer from {request.MentorFirstName ?? "the FirstSteps team"}</p>
                          <p>{request.ResolutionText}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <HelpRequestForm journeyTaskId={task.JourneyTaskID} taskTitle={task.TaskTitle} />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              {task.TaskStatus === "NotApplicable" ? (
                <p className="text-sm text-muted-foreground">This task no longer applies after your plan changed. It is kept for your history.</p>
              ) : (
                <StatusForm journeyTaskId={task.JourneyTaskID} current={task.TaskStatus} locked={locked} />
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Prerequisites</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {task.prerequisites.length === 0 ? (
                <p className="text-muted-foreground">None. You can start right away.</p>
              ) : (
                <ul className="grid gap-2">
                  {task.prerequisites.map((p) => (
                    <li key={p.taskId} className="flex items-center justify-between gap-2">
                      {p.journeyTaskId ? (
                        <Link href={`/tasks/${p.journeyTaskId}`} className="min-w-0 truncate text-primary underline-offset-4 hover:underline">
                          {p.title}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate text-muted-foreground">{p.title}</span>
                      )}
                      {p.status ? <TaskStatusBadge status={p.status} /> : <Badge variant="outline">Not in your plan</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              {unavailable.length > 0 && (
                <Alert>
                  <ShieldQuestionIcon />
                  <AlertTitle>A prerequisite is not part of your plan</AlertTitle>
                  <AlertDescription>
                    Because of your programme or housing situation, a required task does not apply to you, so this task cannot be completed
                    yet. Use &ldquo;I&apos;m stuck&rdquo; and a mentor will help.
                  </AlertDescription>
                </Alert>
              )}
              {locked && unavailable.length === 0 && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <LockIcon className="size-3.5" /> Finish the tasks above to unlock this one.
                </p>
              )}
            </CardContent>
          </Card>

          {task.dependents.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <LockOpenIcon className="size-4" /> Unlocks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {task.dependents.map((d) => (
                    <li key={d.taskId} className="flex items-center justify-between gap-2">
                      <Link href={`/tasks/${d.journeyTaskId}`} className="min-w-0 truncate text-primary underline-offset-4 hover:underline">
                        {d.title}
                      </Link>
                      <TaskStatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <p className="flex gap-1.5 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" /> {task.UniversityName}, {task.City}
          </p>
        </div>
      </div>
    </div>
  );
}
