import { ArrowRightIcon, CompassIcon, HandHelpingIcon, PartyPopperIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDate, PageHeader, StatCard } from "@/components/page";
import { RequestStatusBadge, TaskStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { summarizeProgress } from "@/domain/progress";
import { JOURNEY_STAGES, STAGE_LABELS } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { listJourneys } from "@/server/repositories/journeys";
import { listJourneyTasks } from "@/server/repositories/tasks";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("Student");
  const [journeys, requests] = await Promise.all([listJourneys(user.id), listStudentRequests(user.id)]);
  const journey = journeys.find((j) => j.JourneyStatus === "Planning" || j.JourneyStatus === "Active") ?? journeys[0];

  if (!journey) {
    return (
      <div className="grid gap-6">
        <PageHeader title={`Hello, ${user.firstName}`} />
        <EmptyState icon={CompassIcon} title="Let’s plan your arrival">
          <p>Answer a few questions and FirstSteps builds a task list for your move.</p>
          <Button asChild className="mt-4">
            <Link href="/onboarding">Start planning</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const tasks = await listJourneyTasks(journey.JourneyID);
  const progress = summarizeProgress(tasks.map((t) => t.TaskStatus));
  const nextUp = tasks.filter((t) => (t.TaskStatus === "Pending" || t.TaskStatus === "InProgress") && t.unmet.length === 0).slice(0, 5);
  const openRequests = requests.filter((r) => r.RequestStatus === "Open" || r.RequestStatus === "Assigned").length;
  const answered = requests.filter((r) => r.RequestStatus === "Resolved").length;
  const daysToArrival = journey.DaysToArrival;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hello, ${user.firstName}`}
        description={`${journey.UniversityName} · ${journey.City} · arrival ${formatDate(journey.ArrivalDate)}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/journey/${journey.JourneyID}`}>
              Open journey <ArrowRightIcon />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall progress" value={`${progress.percent}%`} hint={`${progress.completed} of ${progress.total} tasks`} />
        <StatCard
          label={daysToArrival >= 0 ? "Days until arrival" : "Days since arrival"}
          value={Math.abs(daysToArrival)}
          hint={formatDate(journey.ArrivalDate)}
        />
        <StatCard label="Open help requests" value={openRequests} hint={`${answered} answered`} />
        <StatCard label="Blocked tasks" value={progress.blocked} hint="Marked as blocked" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Next up</CardTitle>
            <CardDescription>Tasks you can work on now, in order.</CardDescription>
          </CardHeader>
          <CardContent>
            {nextUp.length === 0 ? (
              <EmptyState icon={PartyPopperIcon} title={progress.total > 0 && progress.completed === progress.total ? "All tasks completed" : "Nothing available right now"} className="py-6">
                {progress.completed < progress.total && "Remaining tasks are locked or blocked. Open your journey for details."}
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {nextUp.map((task) => (
                  <li key={task.JourneyTaskID}>
                    <Link href={`/tasks/${task.JourneyTaskID}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{task.TaskTitle}</span>
                        <span className="text-xs text-muted-foreground">{STAGE_LABELS[task.JourneyStage]}</span>
                      </span>
                      <TaskStatusBadge status={task.TaskStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress by stage</CardTitle>
            <CardDescription>Completed tasks out of tasks that apply to you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {JOURNEY_STAGES.map((stage) => {
              const stageProgress = summarizeProgress(tasks.filter((t) => t.JourneyStage === stage).map((t) => t.TaskStatus));
              if (stageProgress.total === 0) return null;
              return (
                <div key={stage} className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{STAGE_LABELS[stage]}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {stageProgress.completed}/{stageProgress.total}
                    </span>
                  </div>
                  <Progress value={stageProgress.percent} aria-label={`${STAGE_LABELS[stage]} ${stageProgress.percent}%`} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent help requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState icon={HandHelpingIcon} title="No help requests" className="py-6">
              Stuck on a task? Open it and use &ldquo;I&apos;m stuck&rdquo;.
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {requests.slice(0, 4).map((request) => (
                <li key={request.RequestID} className="flex items-center gap-3 py-2.5">
                  <Link href={`/tasks/${request.JourneyTaskID}`} className="min-w-0 flex-1 hover:text-primary">
                    <span className="block truncate font-medium">{request.Subject}</span>
                    <span className="text-xs text-muted-foreground">{request.TaskTitle}</span>
                  </Link>
                  <RequestStatusBadge status={request.RequestStatus} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
