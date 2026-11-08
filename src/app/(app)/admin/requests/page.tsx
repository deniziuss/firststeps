import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDateTime, PageHeader } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { Card, CardContent } from "@/components/ui/card";
import { REQUEST_STATUSES, type RequestStatus } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { listAllRequests } from "@/server/repositories/help";
import { listActiveMentors } from "@/server/repositories/users";
import { AssignForm } from "./assign-form";

export const metadata: Metadata = { title: "Help requests" };

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/requests">) {
  const user = await requireRole("Admin");
  const requested = (await searchParams).status;
  const status = REQUEST_STATUSES.find((s) => s === requested) as RequestStatus | undefined;
  const [requests, mentors] = await Promise.all([listAllRequests(status), listActiveMentors()]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Help requests" description="Assign each request to a mentor. Assign one to yourself to answer it from the mentor view." />
      <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
        {[undefined, ...REQUEST_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/requests?status=${s}` : "/admin/requests"}
            aria-current={s === status ? "page" : undefined}
            className="rounded-full border px-3 py-1 text-sm aria-[current=page]:border-primary aria-[current=page]:text-primary"
          >
            {s ?? "All"}
          </Link>
        ))}
      </nav>
      {requests.length === 0 ? (
        <EmptyState icon={InboxIcon} title="No help requests" />
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Card key={r.RequestID} size="sm">
              <CardContent className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.Subject}</p>
                    <RequestStatusBadge status={r.RequestStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.TaskTitle} · {r.UniversityName} · {r.StudentFirstName} · {formatDateTime(r.CreatedAt)}
                    {r.MentorFirstName && ` · mentor ${r.MentorFirstName}`}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.ProblemDescription}</p>
                </div>
                {(r.RequestStatus === "Open" || r.RequestStatus === "Assigned") && (
                  <div className="flex flex-wrap items-center gap-2">
                    <AssignForm requestId={r.RequestID} mentors={mentors.map((m) => ({ id: m.UserID, label: `${m.FirstName} ${m.LastName} (${m.UserRole})` }))} />
                    {r.MentorFirstName && r.RequestStatus === "Assigned" && mentors.some((m) => m.UserID === user.id) && (
                      <Link href={`/mentor/requests/${r.RequestID}`} className="text-sm text-primary underline-offset-4 hover:underline">
                        Answer
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
