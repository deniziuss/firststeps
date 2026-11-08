import { ArrowLeftIcon, ExternalLinkIcon, InfoIcon, LanguagesIcon, LockIcon, ShieldQuestionIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/page";
import { displayStatus, RequestStatusBadge, SourceStatusBadge, TaskStatusBadge } from "@/components/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { categoryLabel } from "@/lib/content";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { getTaskDetail } from "@/server/repositories/tasks";
import { HelpRequestForm, RefreshPlanForm, StatusActions } from "./task-forms";

// The document title names the task, so browser tabs and screen readers can tell task pages apart.
export async function generateMetadata({ params }: PageProps<"/[locale]/tasks/[journeyTaskId]">): Promise<Metadata> {
  const user = await requireRole("Student");
  const { t, locale } = await getI18n();
  const journeyTaskId = Number((await params).journeyTaskId);
  const task = Number.isInteger(journeyTaskId) ? await getTaskDetail(user.id, journeyTaskId, locale) : undefined;
  return { title: task?.TaskTitle ?? t("task.whatToDo") };
}

export default async function TaskPage({ params }: PageProps<"/[locale]/tasks/[journeyTaskId]">) {
  const user = await requireRole("Student");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const journeyTaskId = Number((await params).journeyTaskId);
  const task = Number.isInteger(journeyTaskId) ? await getTaskDetail(user.id, journeyTaskId, locale) : undefined;
  if (!task) notFound();

  const requests = await listStudentRequests(user.id, locale, task.JourneyTaskID);
  const locked = task.unmet.length > 0;
  const missing = task.unmet.some((u) => u.reason === "missing");
  const unavailable = !missing && task.unmet.some((u) => u.reason === "notApplicable");
  const status = displayStatus(task.TaskStatus, locked);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <Link href={`/journey/${task.JourneyID}`} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden /> {t("task.backToJourney")}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t(`stages.${task.JourneyStage}`)} · {categoryLabel(i18n, task.Category)} · {t("task.priority", { value: task.Priority })}
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold sm:text-4xl">{task.TaskTitle}</h1>
        {/* On small screens the status panel comes after the guidance, so show the status right away. */}
        <div className="lg:hidden">
          <TaskStatusBadge status={status} i18n={i18n} />
        </div>
        {task.IsFallback && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LanguagesIcon className="size-4" aria-hidden /> {t("task.translationMissing")}
          </p>
        )}
      </div>

      {/* Reading order (also on phones): guidance and sources, then status and prerequisites, then help.
          On wide screens the status column sits beside both. */}
      <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:grid-rows-[auto_1fr]">
        <div className="grid min-w-0 content-start gap-10 lg:col-start-1 lg:row-start-1">
          <Section id="what-to-do" title={t("task.whatToDo")}>
            <div className="grid gap-3 text-base leading-relaxed">
              <p>{task.Description ?? t("task.noGuidance")}</p>
              <p className="flex gap-2 text-sm text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("task.notLegalAdvice")}
              </p>
            </div>
          </Section>

          <Section id="sources" title={t("task.sourcesTitle")} description={t("task.sourcesIntro")}>
            {task.sources.length === 0 ? (
              <p className="text-muted-foreground">{t("task.noSources")}</p>
            ) : (
              <ul className="grid gap-3">
                {task.sources.map((source) => (
                  <li key={source.SourceID} className="grid gap-2 rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{source.SourceTitle}</p>
                      <SourceStatusBadge status={source.SourceStatus} i18n={i18n} />
                    </div>
                    {source.SourceURL && (
                      <a
                        href={source.SourceURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-1.5 text-sm break-all underline decoration-gold/60 underline-offset-4 hover:decoration-gold"
                      >
                        {source.SourceURL} <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                        <span className="sr-only">({t("common.externalLink")})</span>
                      </a>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {source.SourceStatus === "Verified"
                        ? t("sourceStatus.Verified.detail", { date: format.date(source.LastVerifiedAt) })
                        : t(`sourceStatus.${source.SourceStatus}.detail`)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

        </div>

        <aside className="grid content-start gap-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <section aria-labelledby="status" className="grid gap-4 rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 id="status" className="text-lg font-semibold">
                {t("task.actionsTitle")}
              </h2>
              <TaskStatusBadge status={status} i18n={i18n} />
            </div>
            <p className="text-sm text-muted-foreground">
              {task.CompletedAt ? t("task.completedOn", { date: format.dateTime(task.CompletedAt) }) : t(`taskStatus.${status}.description`)}
            </p>
            {task.TaskStatus === "NotApplicable" ? (
              <p className="text-sm">{t("task.notApplicableText")}</p>
            ) : (
              <StatusActions journeyTaskId={task.JourneyTaskID} status={task.TaskStatus} locked={locked} />
            )}
          </section>

          <section aria-labelledby="prerequisites" className="grid gap-3 rounded-2xl border bg-card p-5">
            <h2 id="prerequisites" className="text-lg font-semibold">
              {t("task.prerequisitesTitle")}
            </h2>
            {task.prerequisites.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("task.noPrerequisites")}</p>
            ) : (
              <ul className="grid gap-2">
                {task.prerequisites.map((p) => (
                  <li key={p.taskId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    {p.journeyTaskId ? (
                      <Link href={`/tasks/${p.journeyTaskId}`} className="min-w-0 font-medium underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                        {p.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 text-muted-foreground">{p.title}</span>
                    )}
                    {p.status ? (
                      <TaskStatusBadge status={p.status} i18n={i18n} />
                    ) : (
                      <span className="rounded-full border px-2.5 py-1 text-xs">{t("task.notInYourPlan")}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {missing ? (
              <Alert className="border-gold/50 bg-gold-soft">
                <ShieldQuestionIcon aria-hidden />
                <AlertTitle>{t("task.missingTitle")}</AlertTitle>
                <AlertDescription className="grid gap-3 text-foreground">
                  <p>{t("task.missingText")}</p>
                  <RefreshPlanForm journeyId={task.JourneyID} />
                </AlertDescription>
              </Alert>
            ) : unavailable ? (
              <Alert className="border-gold/50 bg-gold-soft">
                <ShieldQuestionIcon aria-hidden />
                <AlertTitle>{t("task.unavailableTitle")}</AlertTitle>
                <AlertDescription className="text-foreground">{t("task.unavailableText")}</AlertDescription>
              </Alert>
            ) : (
              locked && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <LockIcon className="size-4" aria-hidden /> {t("task.lockedText")}
                </p>
              )
            )}
          </section>

          {task.dependents.length > 0 && (
            <section aria-labelledby="unlocks" className="grid gap-3 rounded-2xl border bg-card p-5">
              <h2 id="unlocks" className="text-lg font-semibold">
                {t("task.unlocksTitle")}
              </h2>
              <ul className="grid gap-2">
                {task.dependents.map((d) => (
                  <li key={d.taskId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link href={`/tasks/${d.journeyTaskId}`} className="min-w-0 font-medium underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                      {d.title}
                    </Link>
                    <TaskStatusBadge status={d.status} i18n={i18n} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-sm text-muted-foreground">{t("task.location", { university: task.UniversityName, city: task.City })}</p>
        </aside>

        <div className="grid min-w-0 content-start lg:col-start-1 lg:row-start-2">
          <Section id="stuck" title={t("help.stuckTitle")} description={t("help.stuckIntro")}>
            {requests.length > 0 && (
              <ul className="grid gap-3">
                {requests.map((request) => (
                  <li key={request.RequestID} className="grid gap-2 rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{request.Subject}</p>
                      <RequestStatusBadge status={request.RequestStatus} i18n={i18n} />
                    </div>
                    <p className="text-muted-foreground">{request.ProblemDescription}</p>
                    {request.ResolutionText && (
                      <div className="mt-1 rounded-lg border-l-4 border-gold bg-gold-soft p-3">
                        <p className="text-sm font-medium">{t("help.answerFrom", { name: request.MentorFirstName ?? t("help.team") })}</p>
                        <p className="mt-1">{request.ResolutionText}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <HelpRequestForm journeyTaskId={task.JourneyTaskID} taskTitle={task.TaskTitle} startOpen={unavailable} />
          </Section>
        </div>
      </div>
    </div>
  );
}
