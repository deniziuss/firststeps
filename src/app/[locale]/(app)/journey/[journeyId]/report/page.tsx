import { parseId } from "@/lib/ids";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayStatus } from "@/components/status";
import { summarizeProgress } from "@/domain/progress";
import type { TaskStatus } from "@/domain/statuses";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { getJourney } from "@/server/repositories/journeys";
import { listJourneyTasks, pendingTaskReport } from "@/server/repositories/tasks";
import { PrintButton } from "./print-button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("report.title") };
}

export default async function ReportPage({ params }: PageProps<"/[locale]/journey/[journeyId]/report">) {
  const user = await requireRole("Student");
  const { t, format, locale } = await getI18n();
  const journeyId = parseId((await params).journeyId);
  const journey = journeyId !== undefined ? await getJourney(user.id, journeyId) : undefined;
  if (!journey) notFound();

  const [tasks, openTasks, requests] = await Promise.all([listJourneyTasks(journey.JourneyID, locale), pendingTaskReport(journey.JourneyID), listStudentRequests(user.id, locale)]);
  const progress = summarizeProgress(tasks.map((task) => task.TaskStatus));
  const completed = tasks.filter((task) => task.TaskStatus === "Completed");
  const journeyRequests = requests.filter((r) => tasks.some((task) => task.JourneyTaskID === r.JourneyTaskID));
  // The course cursor procedure returns English titles; show them in the user's language.
  const byBaseTitle = new Map(tasks.map((task) => [task.BaseTitle, task]));
  // Same status rule as the journey page: an open task whose prerequisites are not done is "Locked".
  const reportStatus = (title: string, status: TaskStatus) => {
    const task = byBaseTitle.get(title);
    return displayStatus(status, (task?.unmet.length ?? 0) > 0);
  };

  return (
    <article className="mx-auto grid max-w-3xl gap-8 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/journey/${journey.JourneyID}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden /> {t("report.back")}
        </Link>
        <PrintButton label={t("report.print")} />
      </div>

      <header className="border-b border-taupe/50 pb-6">
        <p className="text-sm text-muted-foreground">{t("report.heading")}</p>
        <h1 className="mt-1 text-title font-light">
          {user.firstName} {user.lastName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("report.meta", {
            university: journey.UniversityName,
            city: journey.City,
            programme: t(`programmes.${journey.ProgramType}.label`),
            date: format.date(journey.ArrivalDate),
            status: t(`journeyStatuses.${journey.JourneyStatus}`),
          })}
        </p>
      </header>

      <section aria-labelledby="summary" className="grid gap-2">
        <h2 id="summary" className="text-xl font-normal">
          {t("report.summary")}
        </h2>
        <p>
          {t("report.summaryText", {
            done: progress.completed,
            total: progress.total,
            percent: format.percent(progress.total ? progress.completed / progress.total : 0),
            inProgress: progress.inProgress,
            blocked: progress.blocked,
            open: progress.open,
            notNeeded: progress.notApplicable,
          })}
        </p>
      </section>

      <section aria-labelledby="open-tasks" className="grid gap-3">
        <h2 id="open-tasks" className="text-xl font-normal">
          {t("report.openTasks")}
        </h2>
        {openTasks.length === 0 ? (
          <p className="text-muted-foreground">{t("report.noOpenTasks")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t("report.task")}</TableHead>
                <TableHead>{t("report.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openTasks.map((task) => (
                <TableRow key={task.TaskNumber}>
                  <TableCell>{task.TaskNumber}</TableCell>
                  <TableCell className="whitespace-normal">{byBaseTitle.get(task.TaskTitle)?.TaskTitle ?? task.TaskTitle}</TableCell>
                  <TableCell>{t(`taskStatus.${reportStatus(task.TaskTitle, task.TaskStatus)}.label`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="completed-tasks" className="grid gap-3">
        <h2 id="completed-tasks" className="text-xl font-normal">
          {t("report.completedTasks")}
        </h2>
        {completed.length === 0 ? (
          <p className="text-muted-foreground">{t("report.noCompleted")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("report.task")}</TableHead>
                <TableHead>{t("report.stage")}</TableHead>
                <TableHead>{t("report.completed")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completed.map((task) => (
                <TableRow key={task.JourneyTaskID}>
                  <TableCell className="whitespace-normal">{task.TaskTitle}</TableCell>
                  <TableCell>{t(`stages.${task.JourneyStage}`)}</TableCell>
                  <TableCell>{format.dateTime(task.CompletedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="report-help" className="grid gap-3">
        <h2 id="report-help" className="text-xl font-normal">
          {t("report.helpRequests")}
        </h2>
        {journeyRequests.length === 0 ? (
          <p className="text-muted-foreground">{t("report.noHelp")}</p>
        ) : (
          <ul className="grid gap-1">
            {journeyRequests.map((r) => (
              <li key={r.RequestID}>
                {r.Subject} ({r.TaskTitle}): {t(`requestStatus.${r.RequestStatus}`)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
