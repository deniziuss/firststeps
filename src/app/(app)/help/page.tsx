import { HandHelpingIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDateTime, PageHeader } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { listStudentRequests } from "@/server/repositories/help";
import { RequestActions } from "./request-actions";

export const metadata: Metadata = { title: "Help requests" };

export default async function HelpPage() {
  const user = await requireRole("Student");
  const requests = await listStudentRequests(user.id);

  return (
    <div className="grid gap-6">
      <PageHeader title="Help requests" description="Questions you asked on your tasks and the answers from mentors." />
      {requests.length === 0 ? (
        <EmptyState icon={HandHelpingIcon} title="No help requests yet">
          Open any task in{" "}
          <Link href="/journey" className="font-medium text-primary underline-offset-4 hover:underline">
            your journey
          </Link>{" "}
          and use &ldquo;I&apos;m stuck&rdquo;.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.RequestID}>
              <CardContent className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{request.Subject}</p>
                    <Link href={`/tasks/${request.JourneyTaskID}`} className="text-sm text-primary underline-offset-4 hover:underline">
                      {request.TaskTitle}
                    </Link>
                  </div>
                  <RequestStatusBadge status={request.RequestStatus} />
                </div>
                <p className="text-sm text-muted-foreground">{request.ProblemDescription}</p>
                {request.ResolutionText && (
                  <div className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">
                    <p className="text-xs font-medium">
                      Answer from {request.MentorFirstName ?? "the FirstSteps team"} · {formatDateTime(request.ResolvedAt)}
                    </p>
                    <p className="mt-1">{request.ResolutionText}</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Sent {formatDateTime(request.CreatedAt)}
                    {request.RequestStatus === "Assigned" && request.MentorFirstName && ` · assigned to ${request.MentorFirstName}`}
                  </span>
                  <RequestActions requestId={request.RequestID} status={request.RequestStatus} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
