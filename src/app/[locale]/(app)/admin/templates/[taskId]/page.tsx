import { ArrowLeftIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { removeDependency } from "@/server/actions/admin";
import { requireRole } from "@/server/dal";
import { getTemplate, listPrerequisites, listSources, listTemplates } from "@/server/repositories/admin";
import { listUniversities } from "@/server/repositories/journeys";
import { SourceStatusForm } from "../../sources/source-status-form";
import { TemplateForm } from "../template-form";
import { AddSourceForm, DependencyForm, TranslationForm } from "./template-detail-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.templates.editTitle") };
}

function Panel({ id, title, text, children }: { id: string; title: string; text?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid content-start gap-4 rounded-2xl border bg-card p-6">
      <div>
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
        {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function TemplatePage({ params }: PageProps<"/[locale]/admin/templates/[taskId]">) {
  await requireRole("Admin");
  const i18n = await getI18n();
  const { t, format } = i18n;
  const taskId = Number((await params).taskId);
  const template = Number.isInteger(taskId) ? await getTemplate(taskId) : undefined;
  if (!template) notFound();

  const [universities, prerequisites, templates, sources] = await Promise.all([
    listUniversities(),
    listPrerequisites(template.TaskID),
    listTemplates(),
    listSources({ taskId: template.TaskID, locale: i18n.locale }),
  ]);
  // Admins edit the English text, but in Turkish they pick and read related tasks by their Turkish titles.
  const shownTitle = (row: { TaskTitle: string; TitleTr: string | null }) => (i18n.locale === "tr" && row.TitleTr ? row.TitleTr : row.TaskTitle);
  const candidates = templates.filter((tpl) => tpl.TaskID !== template.TaskID && !prerequisites.some((p) => p.TaskID === tpl.TaskID));

  return (
    <div className="grid gap-8">
      <Link href="/admin/templates" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> {t("admin.templates.back")}
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">{template.TaskTitle}</h1>
        <p className="mt-2 text-muted-foreground">{t("admin.templates.usage", { count: template.UsageCount })}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="grid content-start gap-6">
          <Panel id="details" title={t("admin.templates.editTitle")}>
            <TemplateForm template={template} universities={universities.map((u) => ({ id: u.UniversityID, label: `${u.UniversityName} (${u.City})` }))} />
          </Panel>
          <Panel id="translation" title={t("admin.templates.translationTitle")} text={t("admin.templates.translationIntro")}>
            <TranslationForm taskId={template.TaskID} title={template.TitleTr ?? ""} description={template.DescriptionTr ?? ""} />
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <Panel id="prerequisites" title={t("admin.templates.prereqTitle")} text={t("admin.templates.prereqIntro")}>
            {prerequisites.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.templates.noPrereq")}</p>
            ) : (
              <ul className="grid gap-1">
                {prerequisites.map((p) => (
                  <li key={p.TaskID} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/templates/${p.TaskID}`} className="min-w-0 underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                      {shownTitle(p)}
                    </Link>
                    <form action={removeDependency}>
                      <input type="hidden" name="taskId" value={template.TaskID} />
                      <input type="hidden" name="requiredTaskId" value={p.TaskID} />
                      <Button type="submit" variant="ghost" size="icon-sm" aria-label={t("admin.templates.removePrereq", { task: shownTitle(p) })}>
                        <XIcon aria-hidden />
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <DependencyForm taskId={template.TaskID} candidates={candidates.map((c) => ({ id: c.TaskID, label: shownTitle(c) }))} />
          </Panel>
          <Panel id="sources" title={t("task.sourcesTitle")}>
            {sources.length > 0 && (
              <ul className="grid gap-3">
                {sources.map((s) => (
                  <li key={s.SourceID} className="grid gap-2 rounded-xl border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{s.SourceTitle}</span>
                      <SourceStatusBadge status={s.SourceStatus} i18n={i18n} />
                    </div>
                    {s.SourceURL && <span className="break-all text-muted-foreground">{s.SourceURL}</span>}
                    <span className="text-muted-foreground">
                      {t("admin.sources.lastVerified")}: {format.date(s.LastVerifiedAt)}
                    </span>
                    <SourceStatusForm sourceId={s.SourceID} current={s.SourceStatus} />
                  </li>
                ))}
              </ul>
            )}
            <AddSourceForm taskId={template.TaskID} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
