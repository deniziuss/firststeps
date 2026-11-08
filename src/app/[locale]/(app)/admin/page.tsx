import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, StatCard } from "@/components/page";
import { RequestStatusBadge, SourceStatusBadge } from "@/components/status";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listSources, systemStats } from "@/server/repositories/admin";
import { listAllRequests } from "@/server/repositories/help";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.overview.title") };
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
      {children} <ArrowRightIcon className="size-4" aria-hidden />
    </Link>
  );
}

export default async function AdminPage() {
  await requireRole("Admin");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const [stats, openRequests, pendingSources] = await Promise.all([systemStats(locale), listAllRequests(locale, "Open"), listSources({ status: "PendingReview", locale })]);
  const verified = stats.sourceStatus.find((s) => s.Status === "Verified")?.Total ?? 0;
  const totalSources = stats.sourceStatus.reduce((sum, s) => sum + s.Total, 0);
  const hours = stats.counts.AvgResolveHours;

  return (
    <div className="grid gap-10">
      <PageHeader title={t("admin.overview.title")} description={t("admin.overview.intro")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.overview.students")} value={format.number(stats.counts.Students)} hint={t("admin.overview.activeJourneys", { active: stats.counts.ActiveJourneys, total: stats.counts.Journeys })} />
        <StatCard label={t("admin.overview.templates")} value={format.number(stats.counts.ActiveTemplates)} hint={t("admin.overview.inactiveTemplates", { count: stats.counts.Templates - stats.counts.ActiveTemplates })} />
        <StatCard label={t("admin.overview.verifiedSources")} value={`${verified}/${totalSources}`} hint={t("admin.overview.pendingSources", { count: pendingSources.length })} />
        <StatCard
          label={t("admin.overview.avgAnswer")}
          value={hours === null ? "—" : t("admin.overview.hours", { value: format.decimal(hours) })}
          hint={t("admin.overview.unassigned", { count: openRequests.length })}
        />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <Section id="unassigned" title={t("admin.overview.unassignedTitle")} actions={<MoreLink href="/admin/requests">{t("admin.overview.allRequests")}</MoreLink>}>
          {openRequests.length === 0 ? (
            <p className="text-muted-foreground">{t("admin.overview.allAssigned")}</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {openRequests.slice(0, 5).map((r) => (
                <li key={r.RequestID} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.Subject}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.TaskTitle} · {format.dateTime(r.CreatedAt)}
                    </span>
                  </span>
                  <RequestStatusBadge status={r.RequestStatus} i18n={i18n} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section id="review" title={t("admin.overview.reviewTitle")} actions={<MoreLink href="/admin/sources">{t("admin.overview.review")}</MoreLink>}>
          {pendingSources.length === 0 ? (
            <p className="text-muted-foreground">{t("admin.overview.allReviewed")}</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {pendingSources.slice(0, 5).map((s) => (
                <li key={s.SourceID} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.SourceTitle}</span>
                    <span className="text-sm text-muted-foreground">{s.TaskTitle}</span>
                  </span>
                  <SourceStatusBadge status={s.SourceStatus} i18n={i18n} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
