import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime, PageHeader, StatCard } from "@/components/page";
import { RequestStatusBadge, SourceStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { listSources, systemStats } from "@/server/repositories/admin";
import { listAllRequests } from "@/server/repositories/help";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminPage() {
  await requireRole("Admin");
  const [stats, openRequests, pendingSources] = await Promise.all([systemStats(), listAllRequests("Open"), listSources({ status: "PendingReview" })]);
  const verified = stats.sourceStatus.find((s) => s.Status === "Verified")?.Total ?? 0;
  const totalSources = stats.sourceStatus.reduce((sum, s) => sum + s.Total, 0);

  return (
    <div className="grid gap-6">
      <PageHeader title="Overview" description="Live figures from the FirstSteps database." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={stats.counts.Students} hint={`${stats.counts.ActiveJourneys} active journeys of ${stats.counts.Journeys}`} />
        <StatCard label="Task templates" value={stats.counts.ActiveTemplates} hint={`${stats.counts.Templates - stats.counts.ActiveTemplates} inactive`} />
        <StatCard label="Verified sources" value={`${verified}/${totalSources}`} hint={`${pendingSources.length} waiting for review`} />
        <StatCard
          label="Avg. time to answer"
          value={stats.counts.AvgResolveHours === null ? "—" : `${stats.counts.AvgResolveHours.toFixed(1)} h`}
          hint={`${openRequests.length} unassigned requests`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Unassigned help requests</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/requests">
                All requests <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {openRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every request has a mentor.</p>
            ) : (
              <ul className="divide-y">
                {openRequests.slice(0, 5).map((r) => (
                  <li key={r.RequestID} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.Subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.TaskTitle} · {formatDateTime(r.CreatedAt)}
                      </span>
                    </span>
                    <RequestStatusBadge status={r.RequestStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Sources waiting for review</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/sources">
                Review <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">All sources are reviewed.</p>
            ) : (
              <ul className="divide-y">
                {pendingSources.slice(0, 5).map((s) => (
                  <li key={s.SourceID} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.SourceTitle}</span>
                      <span className="text-xs text-muted-foreground">{s.TaskTitle}</span>
                    </span>
                    <SourceStatusBadge status={s.SourceStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
