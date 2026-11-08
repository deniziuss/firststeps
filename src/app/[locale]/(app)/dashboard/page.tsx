import { ArrowRightIcon, CompassIcon, PartyPopperIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { displayStatus, TaskStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { summarizeProgress } from "@/domain/progress";
import { JOURNEY_STAGES } from "@/domain/statuses";
import { getI18n } from "@/i18n/server";
import { categoryLabel } from "@/lib/content";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { listJourneys } from "@/server/repositories/journeys";
import { listJourneyTasks } from "@/server/repositories/tasks";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.dashboard") };
}

export default async function DashboardPage() {
  const user = await requireRole("Student");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const [journeys, requests] = await Promise.all([listJourneys(user.id), listStudentRequests(user.id, locale)]);
  const journey = journeys.find((j) => j.JourneyStatus === "Planning" || j.JourneyStatus === "Active") ?? journeys[0];

  if (!journey) {
    return (
      <div className="grid gap-8">
        <PageHeader title={t("dashboard.greeting", { name: user.firstName })} />
        <EmptyState icon={CompassIcon} title={t("dashboard.startTitle")}>
          <p>{t("dashboard.startText")}</p>
          <Button asChild size="lg" className="mt-5">
            <Link href="/onboarding">{t("dashboard.startCta")}</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const tasks = await listJourneyTasks(journey.JourneyID, locale);
  const progress = summarizeProgress(tasks.map((task) => task.TaskStatus));
  const available = tasks.filter((task) => (task.TaskStatus === "InProgress" || task.TaskStatus === "Pending") && task.unmet.length === 0);
  // Continue what was started first, then the earliest open task.
  const [next, ...upcoming] = [...available.filter((task) => task.TaskStatus === "InProgress"), ...available.filter((task) => task.TaskStatus === "Pending")];
  const waiting = requests.filter((r) => r.RequestStatus === "Open" || r.RequestStatus === "Assigned").length;
  const days = journey.DaysToArrival;

  return (
    <div className="grid gap-10">
      <PageHeader
        title={t("dashboard.greeting", { name: user.firstName })}
        description={t("dashboard.context", { university: journey.UniversityName, city: journey.City, date: format.date(journey.ArrivalDate) })}
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="next-step" className="flex flex-col gap-4 rounded-2xl bg-hero p-6 text-hero-foreground sm:p-8">
          <h2 id="next-step" className="text-sm font-medium tracking-[0.14em] text-hero-muted uppercase">
            {t("dashboard.nextStep")}
          </h2>
          {next ? (
            <>
              <p className="font-heading text-2xl leading-snug font-semibold sm:text-3xl">{next.TaskTitle}</p>
              <p className="text-hero-muted">
                {t(`stages.${next.JourneyStage}`)} · {categoryLabel(i18n, next.Category)}
              </p>
              <div className="mt-auto pt-2">
                <Button asChild size="lg" className="border-transparent bg-hero-foreground text-hero hover:bg-hero-foreground/90">
                  <Link href={`/tasks/${next.JourneyTaskID}`}>
                    {t("dashboard.nextStepCta")} <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
              </div>
            </>
          ) : progress.total > 0 && progress.completed === progress.total ? (
            <p className="flex items-center gap-3 font-heading text-2xl font-semibold">
              <PartyPopperIcon className="size-7 text-hero-muted" aria-hidden /> {t("dashboard.allDone")}
            </p>
          ) : (
            <>
              <p className="font-heading text-2xl font-semibold">{t("dashboard.nothingAvailable")}</p>
              <p className="text-hero-muted">{t("dashboard.nothingAvailableText")}</p>
              <div className="mt-auto pt-2">
                <Button asChild variant="outline" className="border-hero-muted/50 text-hero-foreground hover:bg-white/10 hover:text-hero-foreground">
                  <Link href={`/journey/${journey.JourneyID}`}>{t("dashboard.openJourney")}</Link>
                </Button>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="progress" className="grid content-start gap-4 rounded-2xl border bg-card p-6 sm:p-8">
          <h2 id="progress" className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {t("dashboard.progress")}
          </h2>
          <p className="font-heading text-5xl font-semibold tabular-nums">{format.percent(progress.total ? progress.completed / progress.total : 0)}</p>
          <Progress value={progress.percent} aria-label={t("dashboard.progress")} />
          <p className="text-muted-foreground">{t("dashboard.progressText", { done: progress.completed, count: progress.total })}</p>
          <p className="border-t pt-4 font-medium">
            {days > 0
              ? t("dashboard.daysToArrival", { count: days })
              : days === 0
                ? t("dashboard.arrivalToday")
                : t("dashboard.daysSinceArrival", { count: -days })}
          </p>
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section
          id="upcoming"
          title={t("dashboard.upNext")}
          actions={
            <Link href={`/journey/${journey.JourneyID}`} className="text-sm font-medium underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
              {t("dashboard.openJourney")}
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground">{t("dashboard.nothingAvailableText")}</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {upcoming.slice(0, 4).map((task) => (
                <li key={task.JourneyTaskID}>
                  <Link href={`/tasks/${task.JourneyTaskID}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-accent">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{task.TaskTitle}</span>
                      <span className="text-sm text-muted-foreground">{t(`stages.${task.JourneyStage}`)}</span>
                    </span>
                    <TaskStatusBadge status={displayStatus(task.TaskStatus, false)} i18n={i18n} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid content-start gap-10">
          <Section id="by-stage" title={t("dashboard.byStage")}>
            <ul className="grid gap-4">
              {JOURNEY_STAGES.map((stage) => {
                const stageProgress = summarizeProgress(tasks.filter((task) => task.JourneyStage === stage).map((task) => task.TaskStatus));
                if (stageProgress.total === 0) return null;
                return (
                  <li key={stage} className="grid gap-2">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium">{t(`stages.${stage}`)}</span>
                      <span className="text-muted-foreground tabular-nums">{t("journey.stageDone", { done: stageProgress.completed, count: stageProgress.total })}</span>
                    </div>
                    <Progress value={stageProgress.percent} aria-label={t(`stages.${stage}`)} />
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section id="help" title={t("dashboard.helpTitle")}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <p className="text-muted-foreground">{waiting > 0 ? t("dashboard.helpWaiting", { count: waiting }) : requests.length === 0 ? t("dashboard.helpEmpty") : t("dashboard.helpAllAnswered")}</p>
              {requests.length > 0 && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/help">{t("dashboard.viewHelp")}</Link>
                </Button>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
