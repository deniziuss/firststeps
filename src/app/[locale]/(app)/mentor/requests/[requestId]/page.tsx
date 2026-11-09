import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestStatusBadge } from "@/components/status";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { getMentorRequest } from "@/server/repositories/help";
import { ResolveForm } from "./resolve-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("mentor.answerTitle") };
}

export default async function MentorRequestPage({ params }: PageProps<"/[locale]/mentor/requests/[requestId]">) {
  const user = await requireRole("Mentor", "Admin");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const requestId = Number((await params).requestId);
  // Only requests assigned to this mentor are found; anything else is a 404.
  const request = Number.isInteger(requestId) ? await getMentorRequest(user.id, requestId, locale) : undefined;
  if (!request) notFound();

  const canAnswer = request.RequestStatus === "Assigned" || request.RequestStatus === "Open";

  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/mentor" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> {t("mentor.back")}
      </Link>
      <article className="grid gap-4 shape-cut border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-title font-light">{request.Subject}</h1>
          <RequestStatusBadge status={request.RequestStatus} i18n={i18n} />
        </div>
        <p className="text-muted-foreground">
          {request.StudentFirstName} · {t(`programmes.${request.ProgramType as "Erasmus"}.label`)} · {request.UniversityName} ·{" "}
          {t("journey.arrival", { date: format.date(request.ArrivalDate) })}
        </p>
        <p>
          <span className="font-medium">{t("mentor.task")}:</span> {request.TaskTitle}
        </p>
        <p className="rounded-lg bg-muted p-4 whitespace-pre-line">{request.ProblemDescription}</p>
        <p className="text-sm text-muted-foreground">{t("mentor.sent", { date: format.dateTime(request.CreatedAt) })}</p>
      </article>
      {canAnswer ? (
        <section aria-labelledby="answer" className="grid gap-4 shape-cut border bg-card p-6 sm:p-8">
          <div>
            <h2 id="answer" className="text-xl font-normal">
              {t("mentor.answerTitle")}
            </h2>
            <p className="mt-1 text-muted-foreground">{t("mentor.answerIntro")}</p>
          </div>
          <ResolveForm requestId={request.RequestID} />
        </section>
      ) : (
        <section aria-labelledby="answered" className="grid gap-3 shape-cut-sm border border-ochre/40 bg-gold-soft p-6">
          <h2 id="answered" className="text-lg font-medium">
            {t("mentor.answeredOn", { date: format.dateTime(request.ResolvedAt) })}
          </h2>
          <p className="whitespace-pre-line">{request.ResolutionText}</p>
        </section>
      )}
    </div>
  );
}
