import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/components/page";
import { RequestStatusBadge } from "@/components/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { getMentorRequest } from "@/server/repositories/help";
import { ResolveForm } from "./resolve-form";

export const metadata: Metadata = { title: "Help request" };

export default async function MentorRequestPage({ params }: PageProps<"/mentor/requests/[requestId]">) {
  const user = await requireRole("Mentor", "Admin");
  const requestId = Number((await params).requestId);
  // Only requests assigned to this mentor are found; anything else is a 404.
  const request = Number.isInteger(requestId) ? await getMentorRequest(user.id, requestId) : undefined;
  if (!request) notFound();

  const canAnswer = request.RequestStatus === "Assigned" || request.RequestStatus === "Open";

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/mentor" className="text-sm text-muted-foreground hover:text-foreground">
        ← Assigned requests
      </Link>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{request.Subject}</CardTitle>
            <RequestStatusBadge status={request.RequestStatus} />
          </div>
          <CardDescription>
            {request.StudentFirstName} · {request.ProgramType} · {request.UniversityName} · arrival {formatDate(request.ArrivalDate)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>
            <span className="font-medium">Task:</span> {request.TaskTitle}
          </p>
          <p className="whitespace-pre-line rounded-lg bg-muted p-3">{request.ProblemDescription}</p>
          <p className="text-xs text-muted-foreground">Sent {formatDateTime(request.CreatedAt)}</p>
        </CardContent>
      </Card>
      {canAnswer ? (
        <Card>
          <CardHeader>
            <CardTitle>Your answer</CardTitle>
            <CardDescription>The student sees this on the task page. Point to official sources where possible.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResolveForm requestId={request.RequestID} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Answer sent {formatDateTime(request.ResolvedAt)}</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm">{request.ResolutionText}</CardContent>
        </Card>
      )}
    </div>
  );
}
