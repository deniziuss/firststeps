import { BookOpenCheckIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDate, PageHeader } from "@/components/page";
import { SourceStatusBadge } from "@/components/status";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/dal";
import { listSources } from "@/server/repositories/admin";
import { SourceStatusForm } from "./source-status-form";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  await requireRole("Admin");
  const sources = await listSources({});

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Official sources"
        description="Open each link, check the information, then mark it verified. Students see the status and the date of the last check."
      />
      {sources.length === 0 ? (
        <EmptyState icon={BookOpenCheckIcon} title="No sources yet">
          Add sources from a task template.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last verified</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => (
                  <TableRow key={s.SourceID}>
                    <TableCell className="max-w-64">
                      <p className="font-medium">{s.SourceTitle}</p>
                      {s.SourceURL && (
                        <a href={s.SourceURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline">
                          {s.SourceURL} <ExternalLinkIcon className="size-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/templates/${s.TaskID}`} className="text-sm hover:text-primary">
                        {s.TaskTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <SourceStatusBadge status={s.SourceStatus} />
                    </TableCell>
                    <TableCell>{formatDate(s.LastVerifiedAt)}</TableCell>
                    <TableCell>
                      <SourceStatusForm sourceId={s.SourceID} current={s.SourceStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
