import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_LABELS } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { listTemplates } from "@/server/repositories/admin";
import { listUniversities } from "@/server/repositories/journeys";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Task templates" };

export default async function TemplatesPage() {
  await requireRole("Admin");
  const [templates, universities] = await Promise.all([listTemplates(), listUniversities()]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Task templates" description="Templates decide which tasks new journeys get. Existing journey tasks keep their history." />
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead className="text-right">Prereq.</TableHead>
                <TableHead className="text-right">Sources</TableHead>
                <TableHead className="text-right">In journeys</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.TaskID} className={t.IsActive ? undefined : "opacity-60"}>
                  <TableCell>
                    <Link href={`/admin/templates/${t.TaskID}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {t.TaskTitle}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {t.Category} · priority {t.Priority} {!t.IsActive && "· inactive"}
                    </div>
                  </TableCell>
                  <TableCell>{STAGE_LABELS[t.JourneyStage]}</TableCell>
                  <TableCell className="space-x-1">
                    <Badge variant="outline">{t.UniversityName ?? "All universities"}</Badge>
                    {t.ApplicableProgram !== "All" && <Badge variant="outline">{t.ApplicableProgram}</Badge>}
                    {t.AccommodationCondition !== "Any" && <Badge variant="outline">Housing: {t.AccommodationCondition}</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.DependencyCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.SourceCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.UsageCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>New template</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateForm universities={universities.map((u) => ({ id: u.UniversityID, label: `${u.UniversityName} (${u.City})` }))} />
        </CardContent>
      </Card>
    </div>
  );
}
