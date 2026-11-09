import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { REQUEST_STATUSES, type RequestStatus } from "@/domain/statuses";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listAllRequests } from "@/server/repositories/help";
import { listActiveMentors } from "@/server/repositories/users";
import { AssignForm } from "./assign-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.requests.title") };
}

export default async function AdminRequestsPage({ searchParams }: PageProps<"/[locale]/admin/requests">) {
  const user = await requireRole("Admin");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const requested = (await searchParams).status;
  const status = REQUEST_STATUSES.find((s) => s === requested) as RequestStatus | undefined;
  const [requests, mentors] = await Promise.all([listAllRequests(locale, status), listActiveMentors()]);
  const mentorOptions = mentors.map((m) => ({ id: m.UserID, label: `${m.FirstName} ${m.LastName} (${t(`roles.${m.UserRole}`)})` }));

  return (
    <div className="grid gap-8">
      <PageHeader title={t("admin.requests.title")} description={t("admin.requests.intro")} />
      <nav className="flex flex-wrap gap-2" aria-label={t("admin.requests.filter")}>
        {[undefined, ...REQUEST_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/requests?status=${s}` : "/admin/requests"}
            aria-current={s === status ? "page" : undefined}
            className="inline-flex min-h-10 items-center rounded-full border px-4 text-sm aria-[current=page]:border-primary-border aria-[current=page]:bg-accent"
          >
            {s ? t(`requestStatus.${s}`) : t("admin.requests.all")}
          </Link>
        ))}
      </nav>
      {requests.length === 0 ? (
        <EmptyState icon={InboxIcon} title={t("admin.requests.empty")} />
      ) : (
        <ul className="grid gap-3">
          {requests.map((r) => (
            <li key={r.RequestID} data-request={r.Subject} className="grid gap-4 rounded-lg border bg-card p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.Subject}</p>
                  <RequestStatusBadge status={r.RequestStatus} i18n={i18n} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("admin.requests.meta", { task: r.TaskTitle, university: r.UniversityName, name: r.StudentFirstName, date: format.dateTime(r.CreatedAt) })}
                  {r.MentorFirstName && ` · ${t("admin.requests.mentorName", { name: r.MentorFirstName })}`}
                </p>
                <p className="mt-2 line-clamp-2 text-sm">{r.ProblemDescription}</p>
              </div>
              {(r.RequestStatus === "Open" || r.RequestStatus === "Assigned") && (
                <div className="flex flex-wrap items-center gap-3">
                  <AssignForm requestId={r.RequestID} mentors={mentorOptions} />
                  {r.RequestStatus === "Assigned" && mentors.some((m) => m.UserID === user.id) && (
                    <Link href={`/mentor/requests/${r.RequestID}`} className="text-sm font-medium link-accent">
                      {t("admin.requests.answer")}
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
