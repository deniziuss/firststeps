import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/components/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarizeProgress } from "@/domain/progress";
import { STAGE_LABELS, TASK_STATUS_LABELS } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { getJourney } from "@/server/repositories/journeys";
import { listJourneyTasks, pendingTaskReport } from "@/server/repositories/tasks";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Progress report" };

export default async function ReportPage({ params }: PageProps<"/journey/[journeyId]/report">) {
  const user = await requireRole("Student");
  const journeyId = Number((await params).journeyId);
  const journey = Number.isInteger(journeyId) ? await getJourney(user.id, journeyId) : undefined;
  if (!journey) notFound();

  const [tasks, openTasks, requests] = await Promise.all([
    listJourneyTasks(journey.JourneyID),
    pendingTaskReport(journey.JourneyID),
    listStudentRequests(user.id),
  ]);
  const progress = summarizeProgress(tasks.map((t) => t.TaskStatus));
  const completed = tasks.filter((t) => t.TaskStatus === "Completed");
  const journeyRequests = requests.filter((r) => tasks.some((t) => t.JourneyTaskID === r.JourneyTaskID));

  return (
    <article className="mx-auto grid max-w-3xl gap-6 print:max-w-none">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link href={`/journey/${journey.JourneyID}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to journey
        </Link>
        <PrintButton />
      </div>

      <header className="border-b pb-4">
        <p className="text-sm text-muted-foreground">FirstSteps progress report</p>
        <h1 className="text-2xl font-semibold">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {journey.UniversityName}, {journey.City} · {journey.ProgramType} · arrival {formatDate(journey.ArrivalDate)} · status {journey.JourneyStatus}
        </p>
      </header>

      <section>
        <h2 className="mb-2 font-semibold">Summary</h2>
        <p className="text-sm">
          {progress.completed} of {progress.total} applicable tasks completed ({progress.percent}%). {progress.inProgress} in progress, {progress.blocked}{" "}
          blocked, {progress.open} not started. {progress.notApplicable} tasks no longer apply after plan changes.
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Open tasks in order</h2>
        {openTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openTasks.map((t) => (
                <TableRow key={t.TaskNumber}>
                  <TableCell>{t.TaskNumber}</TableCell>
                  <TableCell>{t.TaskTitle}</TableCell>
                  <TableCell>{TASK_STATUS_LABELS[t.TaskStatus]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Completed tasks</h2>
        {completed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completed.map((t) => (
                <TableRow key={t.JourneyTaskID}>
                  <TableCell>{t.TaskTitle}</TableCell>
                  <TableCell>{STAGE_LABELS[t.JourneyStage]}</TableCell>
                  <TableCell>{formatDateTime(t.CompletedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Help requests</h2>
        {journeyRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No help requests for this journey.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {journeyRequests.map((r) => (
              <li key={r.RequestID}>
                {r.Subject} ({r.TaskTitle}): {r.RequestStatus}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
