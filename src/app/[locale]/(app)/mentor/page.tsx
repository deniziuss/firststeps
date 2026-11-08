import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { getI18n } from "@/i18n/server";
import type { I18n } from "@/i18n/translator";
import { requireRole } from "@/server/dal";
import { listMentorRequests, type MentorRequestRow } from "@/server/repositories/help";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("mentor.title") };
}

function RequestList({ requests, i18n }: { requests: MentorRequestRow[]; i18n: I18n }) {
  const { t, format } = i18n;
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {requests.map((request) => (
        <li key={request.RequestID}>
          <Link href={`/mentor/requests/${request.RequestID}`} className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{request.Subject}</p>
              <p className="text-sm text-muted-foreground">
                {t("mentor.meta", { name: request.StudentFirstName, task: request.TaskTitle, date: format.date(request.ArrivalDate), sent: format.date(request.CreatedAt) })}
              </p>
            </div>
            <RequestStatusBadge status={request.RequestStatus} i18n={i18n} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function MentorPage() {
  const user = await requireRole("Mentor", "Admin");
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const requests = await listMentorRequests(user.id, locale);
  const waiting = requests.filter((r) => r.RequestStatus === "Assigned" || r.RequestStatus === "Open");
  const answered = requests.filter((r) => r.RequestStatus === "Resolved" || r.RequestStatus === "Closed");

  return (
    <div className="grid gap-10">
      <PageHeader title={t("mentor.title")} description={t("mentor.intro")} />
      {requests.length === 0 ? (
        <EmptyState icon={InboxIcon} title={t("mentor.emptyTitle")}>
          {t("mentor.emptyText")}
        </EmptyState>
      ) : (
        <>
          <Section id="waiting" title={`${t("mentor.waiting")} (${waiting.length})`}>
            {waiting.length === 0 ? <p className="text-muted-foreground">{t("common.none")}</p> : <RequestList requests={waiting} i18n={i18n} />}
          </Section>
          {answered.length > 0 && (
            <Section id="answered" title={`${t("mentor.answered")} (${answered.length})`}>
              <RequestList requests={answered} i18n={i18n} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
