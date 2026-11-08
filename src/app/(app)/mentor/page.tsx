import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDate, formatDateTime, PageHeader, StatCard } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { requireRole } from "@/server/dal";
import { listMentorRequests } from "@/server/repositories/help";

export const metadata: Metadata = { title: "Assigned requests" };

export default async function MentorPage() {
  const user = await requireRole("Mentor", "Admin");
  const requests = await listMentorRequests(user.id);
  const waiting = requests.filter((r) => r.RequestStatus === "Assigned" || r.RequestStatus === "Open");
  const answered = requests.filter((r) => r.RequestStatus === "Resolved" || r.RequestStatus === "Closed");

  return (
    <div className="grid gap-6">
      <PageHeader title="Assigned requests" description="Only requests assigned to you are listed here." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Waiting for your answer" value={waiting.length} />
        <StatCard label="Answered" value={answered.length} />
        <StatCard label="Closed by students" value={requests.filter((r) => r.RequestStatus === "Closed").length} />
      </div>
      {requests.length === 0 ? (
        <EmptyState icon={InboxIcon} title="No requests assigned to you">
          An administrator assigns new help requests to mentors.
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {requests.map((request) => (
            <li key={request.RequestID}>
              <Link href={`/mentor/requests/${request.RequestID}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/60">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{request.Subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.StudentFirstName} · {request.TaskTitle} · arrival {formatDate(request.ArrivalDate)} · sent {formatDateTime(request.CreatedAt)}
                  </p>
                </div>
                <RequestStatusBadge status={request.RequestStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
