import { XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/page";
import { SourceStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { removeDependency } from "@/server/actions/admin";
import { getTemplate, listPrerequisites, listSources, listTemplates } from "@/server/repositories/admin";
import { listUniversities } from "@/server/repositories/journeys";
import { SourceStatusForm } from "../../sources/source-status-form";
import { TemplateForm } from "../template-form";
import { AddSourceForm, DependencyForm } from "./template-detail-forms";

export const metadata: Metadata = { title: "Edit template" };

export default async function TemplatePage({ params }: PageProps<"/admin/templates/[taskId]">) {
  await requireRole("Admin");
  const taskId = Number((await params).taskId);
  const template = Number.isInteger(taskId) ? await getTemplate(taskId) : undefined;
  if (!template) notFound();

  const [universities, prerequisites, templates, sources] = await Promise.all([
    listUniversities(),
    listPrerequisites(template.TaskID),
    listTemplates(),
    listSources({ taskId: template.TaskID }),
  ]);
  const candidates = templates.filter((t) => t.TaskID !== template.TaskID && !prerequisites.some((p) => p.TaskID === t.TaskID));

  return (
    <div className="grid gap-6">
      <Link href="/admin/templates" className="text-sm text-muted-foreground hover:text-foreground">
        ← Task templates
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{template.TaskTitle}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>Used in {template.UsageCount} journeys. Changes apply to new and re-planned journeys.</CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateForm template={template} universities={universities.map((u) => ({ id: u.UniversityID, label: `${u.UniversityName} (${u.City})` }))} />
          </CardContent>
        </Card>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Prerequisites</CardTitle>
              <CardDescription>Tasks that must be completed first. Cycles are rejected.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {prerequisites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No prerequisites.</p>
              ) : (
                <ul className="grid gap-2">
                  {prerequisites.map((p) => (
                    <li key={p.TaskID} className="flex items-center justify-between gap-2 text-sm">
                      <Link href={`/admin/templates/${p.TaskID}`} className="min-w-0 truncate text-primary underline-offset-4 hover:underline">
                        {p.TaskTitle}
                      </Link>
                      <form action={removeDependency}>
                        <input type="hidden" name="taskId" value={template.TaskID} />
                        <input type="hidden" name="requiredTaskId" value={p.TaskID} />
                        <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remove prerequisite ${p.TaskTitle}`}>
                          <XIcon />
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <DependencyForm taskId={template.TaskID} candidates={candidates.map((c) => ({ id: c.TaskID, label: c.TaskTitle }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Official sources</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sources yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {sources.map((s) => (
                    <li key={s.SourceID} className="grid gap-1 rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.SourceTitle}</span>
                        <SourceStatusBadge status={s.SourceStatus} />
                      </div>
                      {s.SourceURL && <span className="break-all text-xs text-muted-foreground">{s.SourceURL}</span>}
                      <span className="text-xs text-muted-foreground">Last verified {formatDate(s.LastVerifiedAt)}</span>
                      <SourceStatusForm sourceId={s.SourceID} current={s.SourceStatus} />
                    </li>
                  ))}
                </ul>
              )}
              <AddSourceForm taskId={template.TaskID} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
