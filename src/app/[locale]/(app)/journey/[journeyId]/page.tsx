import { CalendarIcon, FileTextIcon, GraduationCapIcon, ListTodoIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/page";
import { StatusLegend } from "@/components/status";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { summarizeProgress } from "@/domain/progress";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { getJourney } from "@/server/repositories/journeys";
import { listJourneyTasks } from "@/server/repositories/tasks";
import { AccommodationForm, JourneyStatusForm } from "./journey-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.journey") };
}

export default async function JourneyPage({ params }: PageProps<"/[locale]/journey/[journeyId]">) {
  const user = await requireRole("Student");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const journeyId = Number((await params).journeyId);
  const journey = Number.isInteger(journeyId) ? await getJourney(user.id, journeyId) : undefined;
  if (!journey) notFound();

  const tasks = await listJourneyTasks(journey.JourneyID, locale);
  const progress = summarizeProgress(tasks.map((task) => task.TaskStatus));

  return (
    <div className="grid gap-8">
      <PageHeader
        title={journey.UniversityName}
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-4" aria-hidden /> {journey.City}, {journey.Country}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-4" aria-hidden /> {t("journey.arrival", { date: format.date(journey.ArrivalDate) })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GraduationCapIcon className="size-4" aria-hidden /> {t(`programmes.${journey.ProgramType}.label`)}
            </span>
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/journey/${journey.JourneyID}/report`}>
              <FileTextIcon aria-hidden /> {t("journey.report")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 shape-cut border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-heading text-5xl font-light tracking-[-0.04em] tabular-nums">{format.percent(progress.total ? progress.completed / progress.total : 0)}</p>
          <p className="text-muted-foreground">{t("journey.progressSummary", { done: progress.completed, count: progress.total })}</p>
        </div>
        <Progress value={progress.percent} aria-label={t("dashboard.progress")} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 content-start gap-6">
          <StatusLegend i18n={i18n} />
          {tasks.length === 0 ? (
            <EmptyState icon={ListTodoIcon} title={t("journey.noTasksTitle")}>
              {t("journey.noTasksText")}
            </EmptyState>
          ) : (
            <TaskList tasks={tasks} i18n={i18n} />
          )}
        </div>
        <aside className="grid content-start gap-6">
          <section aria-labelledby="situation" className="grid gap-4 shape-cut border bg-card p-5">
            <div>
              <h2 id="situation" className="text-lg font-medium">
                {t("journey.situationTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("journey.situationText")}</p>
            </div>
            <AccommodationForm journeyId={journey.JourneyID} current={journey.AccommodationStatus} />
          </section>
          <section aria-labelledby="journey-status" className="grid gap-4 shape-cut border bg-card p-5">
            <h2 id="journey-status" className="text-lg font-medium">
              {t("journey.statusTitle")}
            </h2>
            <JourneyStatusForm journeyId={journey.JourneyID} current={journey.JourneyStatus} />
          </section>
        </aside>
      </div>
    </div>
  );
}
