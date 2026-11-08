import type { Metadata } from "next";
import { BarChartCard, DonutChartCard } from "@/components/charts";
import { PageHeader } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JOURNEY_STAGES, STAGE_LABELS, TASK_STATUS_LABELS, type TaskStatus } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { systemStats } from "@/server/repositories/admin";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireRole("Admin");
  const stats = await systemStats();
  const toData = (rows: { Status: string; Total: number }[], labels?: Record<string, string>) => rows.map((r) => ({ name: labels?.[r.Status] ?? r.Status, value: r.Total }));
  const stageData = JOURNEY_STAGES.map((stage) => {
    const row = stats.stageCompletion.find((s) => s.Stage === stage);
    return { name: STAGE_LABELS[stage], value: row && row.Applicable > 0 ? Math.round((row.Completed / row.Applicable) * 100) : 0 };
  });

  return (
    <div className="grid gap-6">
      <PageHeader title="Reports" description="Anonymous aggregates across all journeys. No personal data is shown." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion rate by stage</CardTitle>
            <CardDescription>Completed tasks as a share of applicable tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChartCard data={stageData} label="Completion" unit="%" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Journey tasks by status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChartCard data={toData(stats.taskStatus, TASK_STATUS_LABELS as Record<TaskStatus, string>)} label="Tasks by status" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Help requests by status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChartCard data={toData(stats.requestStatus)} label="Help requests by status" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Source verification</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChartCard data={toData(stats.sourceStatus, { PendingReview: "Review pending" })} label="Sources by status" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Journeys by programme</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartCard data={toData(stats.programs)} label="Journeys" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active users by role</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartCard data={toData(stats.usersByRole)} label="Users" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Where students get stuck</CardTitle>
          <CardDescription>Tasks with the most help requests or blocked entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.stuckTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No help requests or blocked tasks yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Help requests</TableHead>
                  <TableHead className="text-right">Blocked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.stuckTasks.map((t) => (
                  <TableRow key={t.TaskTitle}>
                    <TableCell>{t.TaskTitle}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.Requests}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.Blocked}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
