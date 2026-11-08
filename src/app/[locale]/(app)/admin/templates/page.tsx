import { LanguagesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { categoryLabel } from "@/lib/content";
import { requireRole } from "@/server/dal";
import { listTemplates } from "@/server/repositories/admin";
import { listUniversities } from "@/server/repositories/journeys";
import { TemplateForm } from "./template-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.templates.title") };
}

const chip = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs whitespace-nowrap";

export default async function TemplatesPage() {
  await requireRole("Admin");
  const i18n = await getI18n();
  const { t } = i18n;
  const [templates, universities] = await Promise.all([listTemplates(), listUniversities()]);

  return (
    <div className="grid gap-10">
      <PageHeader title={t("admin.templates.title")} description={t("admin.templates.intro")} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.templates.task")}</TableHead>
              <TableHead>{t("admin.templates.stage")}</TableHead>
              <TableHead>{t("admin.templates.appliesTo")}</TableHead>
              <TableHead className="text-right">{t("admin.templates.prerequisites")}</TableHead>
              <TableHead className="text-right">{t("admin.templates.sources")}</TableHead>
              <TableHead className="text-right">{t("admin.templates.inJourneys")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((tpl) => (
              <TableRow key={tpl.TaskID} className={tpl.IsActive ? undefined : "text-muted-foreground"}>
                <TableCell className="min-w-64 whitespace-normal">
                  <Link href={`/admin/templates/${tpl.TaskID}`} className="font-medium underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                    {i18n.locale === "tr" && tpl.TitleTr ? tpl.TitleTr : tpl.TaskTitle}
                  </Link>
                  {i18n.locale === "tr" && tpl.TitleTr && <div className="text-xs text-muted-foreground" lang="en">{tpl.TaskTitle}</div>}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{categoryLabel(i18n, tpl.Category)}</span>
                    <span>· {t("task.priority", { value: tpl.Priority })}</span>
                    {!tpl.IsActive && <span>· {t("admin.templates.inactive")}</span>}
                    {!tpl.TitleTr && (
                      <span className="inline-flex items-center gap-1">
                        · <LanguagesIcon className="size-3" aria-hidden /> {t("admin.templates.translationMissing")}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{t(`stages.${tpl.JourneyStage}`)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <span className={chip}>{tpl.UniversityName ?? t("admin.templates.allUniversities")}</span>
                    {tpl.ApplicableProgram !== "All" && <span className={chip}>{t(`programmes.${tpl.ApplicableProgram}.label`)}</span>}
                    {tpl.AccommodationCondition !== "Any" && (
                      <span className={chip}>{t("admin.templates.housing", { value: t(`accommodationOptions.${tpl.AccommodationCondition}.label`) })}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{tpl.DependencyCount}</TableCell>
                <TableCell className="text-right tabular-nums">{tpl.SourceCount}</TableCell>
                <TableCell className="text-right tabular-nums">{tpl.UsageCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Section id="new-task" title={t("admin.templates.newTitle")} className="max-w-3xl">
        <div className="rounded-2xl border bg-card p-6">
          <TemplateForm universities={universities.map((u) => ({ id: u.UniversityID, label: `${u.UniversityName} (${u.City})` }))} />
        </div>
      </Section>
    </div>
  );
}
