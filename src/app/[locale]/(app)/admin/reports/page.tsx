import type { Metadata } from "next";
import { BarChartCard, DonutChartCard } from "@/components/charts";
import { PageHeader } from "@/components/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JOURNEY_STAGES, type ProgramType, type RequestStatus, type SourceStatus, type TaskStatus, type UserRole } from "@/domain/statuses";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { systemStats } from "@/server/repositories/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.reports.title") };
}

function Panel({ id, title, text, children }: { id: string; title: string; text?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-4 rounded-2xl border bg-card p-6">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function ReportsPage() {
  await requireRole("Admin");
  const { t } = await getI18n();
  const stats = await systemStats();
  const noData = t("admin.reports.noData");
  const stageData = JOURNEY_STAGES.map((stage) => {
    const row = stats.stageCompletion.find((s) => s.Stage === stage);
    return { name: t(`stages.${stage}`), value: row && row.Applicable > 0 ? Math.round((row.Completed / row.Applicable) * 100) : 0 };
  });

  return (
    <div className="grid gap-8">
      <PageHeader title={t("admin.reports.title")} description={t("admin.reports.intro")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="completion" title={t("admin.reports.completion")} text={t("admin.reports.completionText")}>
          <BarChartCard data={stageData} label={t("admin.reports.completionLabel")} emptyLabel={noData} unit="%" />
        </Panel>
        <Panel id="tasks-by-status" title={t("admin.reports.tasksByStatus")}>
          <DonutChartCard data={stats.taskStatus.map((r) => ({ name: t(`taskStatus.${r.Status as TaskStatus}.label`), value: r.Total }))} label={t("admin.reports.tasksByStatus")} emptyLabel={noData} />
        </Panel>
        <Panel id="requests-by-status" title={t("admin.reports.requestsByStatus")}>
          <DonutChartCard data={stats.requestStatus.map((r) => ({ name: t(`requestStatus.${r.Status as RequestStatus}`), value: r.Total }))} label={t("admin.reports.requestsByStatus")} emptyLabel={noData} />
        </Panel>
        <Panel id="source-review" title={t("admin.reports.sources")}>
          <DonutChartCard data={stats.sourceStatus.map((r) => ({ name: t(`sourceStatus.${r.Status as SourceStatus}.label`), value: r.Total }))} label={t("admin.reports.sources")} emptyLabel={noData} />
        </Panel>
        <Panel id="programmes" title={t("admin.reports.programmes")}>
          <BarChartCard data={stats.programs.map((r) => ({ name: t(`programmes.${r.Status as ProgramType}.label`), value: r.Total }))} label={t("admin.reports.programmes")} emptyLabel={noData} />
        </Panel>
        <Panel id="roles" title={t("admin.reports.roles")}>
          <BarChartCard data={stats.usersByRole.map((r) => ({ name: t(`roles.${r.Status as UserRole}`), value: r.Total }))} label={t("admin.reports.roles")} emptyLabel={noData} />
        </Panel>
      </div>
      <Panel id="stuck" title={t("admin.reports.stuck")} text={t("admin.reports.stuckText")}>
        {stats.stuckTasks.length === 0 ? (
          <p className="text-muted-foreground">{t("admin.reports.noStuck")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.templates.task")}</TableHead>
                  <TableHead className="text-right">{t("admin.reports.helpRequests")}</TableHead>
                  <TableHead className="text-right">{t("admin.reports.blocked")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.stuckTasks.map((row) => (
                  <TableRow key={row.TaskTitle}>
                    <TableCell className="whitespace-normal">{row.TaskTitle}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.Requests}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.Blocked}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
