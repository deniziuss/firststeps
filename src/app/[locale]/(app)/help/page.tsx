import { HandHelpingIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { RequestActions } from "./request-actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("help.listTitle") };
}

export default async function HelpPage() {
  const user = await requireRole("Student");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const requests = await listStudentRequests(user.id, locale);

  return (
    <div className="grid gap-8">
      <PageHeader title={t("help.listTitle")} description={t("help.listIntro")} />
      {requests.length === 0 ? (
        <EmptyState icon={HandHelpingIcon} title={t("help.emptyTitle")}>
          <p>{t("help.emptyText")}</p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/journey">{t("nav.journey")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
          {requests.map((request) => (
            <li key={request.RequestID} className="grid gap-3 rounded-2xl border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{request.Subject}</h2>
                  <Link href={`/tasks/${request.JourneyTaskID}`} className="text-sm underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                    {request.TaskTitle}
                  </Link>
                </div>
                <RequestStatusBadge status={request.RequestStatus} i18n={i18n} />
              </div>
              <p className="text-muted-foreground">{request.ProblemDescription}</p>
              {request.ResolutionText && (
                <div className="rounded-lg border-l-4 border-gold bg-gold-soft p-4">
                  <p className="text-sm font-medium">
                    {t("help.answerFrom", { name: request.MentorFirstName ?? t("help.team") })} · {format.dateTime(request.ResolvedAt)}
                  </p>
                  <p className="mt-1">{request.ResolutionText}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {t("help.sentOn", { date: format.dateTime(request.CreatedAt) })}
                  {request.RequestStatus === "Assigned" && request.MentorFirstName && ` · ${t("help.assignedTo", { name: request.MentorFirstName })}`}
                </span>
                <RequestActions requestId={request.RequestID} status={request.RequestStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
