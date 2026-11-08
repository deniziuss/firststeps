import { CalendarIcon, FileTextIcon, GraduationCapIcon, ListTodoIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, formatDate, PageHeader, StatCard } from "@/components/page";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { summarizeProgress } from "@/domain/progress";
import { requireRole } from "@/server/dal";
import { getJourney } from "@/server/repositories/journeys";
import { listJourneyTasks } from "@/server/repositories/tasks";
import { AccommodationForm, JourneyStatusForm } from "./journey-forms";

export const metadata: Metadata = { title: "Journey" };

const PROGRAM_LABELS = { Erasmus: "Erasmus exchange", FullTime: "Full-time degree", Other: "Other programme" } as const;

export default async function JourneyPage({ params }: PageProps<"/journey/[journeyId]">) {
  const user = await requireRole("Student");
  const journeyId = Number((await params).journeyId);
  const journey = Number.isInteger(journeyId) ? await getJourney(user.id, journeyId) : undefined;
  if (!journey) notFound();

  const tasks = await listJourneyTasks(journey.JourneyID);
  const progress = summarizeProgress(tasks.map((t) => t.TaskStatus));
  const locked = tasks.filter((t) => t.unmet.length > 0 && t.TaskStatus !== "NotApplicable").length;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`${journey.UniversityName}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3.5" /> Arrival {formatDate(journey.ArrivalDate)}
            </span>
            <span className="inline-flex items-center gap-1">
              <GraduationCapIcon className="size-3.5" /> {PROGRAM_LABELS[journey.ProgramType]}
            </span>
            <span>
              {journey.City}, {journey.Country}
            </span>
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/journey/${journey.JourneyID}/report`}>
              <FileTextIcon /> Progress report
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Progress" value={`${progress.percent}%`} hint={`${progress.completed} of ${progress.total} tasks completed`} />
        <StatCard label="To do" value={progress.open + progress.inProgress} hint={`${progress.inProgress} in progress`} />
        <StatCard label="Locked by prerequisites" value={locked} hint="Unlock by finishing earlier tasks" />
        <StatCard label="Blocked" value={progress.blocked} hint="Marked as blocked by you" />
      </div>
      <Progress value={progress.percent} aria-label={`Journey progress ${progress.percent}%`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {tasks.length === 0 ? (
            <EmptyState icon={ListTodoIcon} title="No tasks in this journey">
              No active task templates matched your university, programme and housing. An administrator can add templates.
            </EmptyState>
          ) : (
            <TaskList tasks={tasks} />
          )}
        </div>
        <div className="grid content-start gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Accommodation</CardTitle>
              <CardDescription>Changing this updates your plan. Completed tasks are always kept.</CardDescription>
            </CardHeader>
            <CardContent>
              <AccommodationForm journeyId={journey.JourneyID} current={journey.AccommodationStatus} />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Journey status</CardTitle>
            </CardHeader>
            <CardContent>
              <JourneyStatusForm journeyId={journey.JourneyID} current={journey.JourneyStatus} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
