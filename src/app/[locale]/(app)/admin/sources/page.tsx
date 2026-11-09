import { BookOpenCheckIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page";
import { SourceStatusBadge } from "@/components/status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listSources } from "@/server/repositories/admin";
import { SourceStatusForm } from "./source-status-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.sources.title") };
}

export default async function SourcesPage() {
  await requireRole("Admin");
  const i18n = await getI18n();
  const { t, format, locale } = i18n;
  const sources = await listSources({ locale });

  return (
    <div className="grid gap-8">
      <PageHeader title={t("admin.sources.title")} description={t("admin.sources.intro")} />
      {sources.length === 0 ? (
        <EmptyState icon={BookOpenCheckIcon} title={t("admin.sources.empty")}>
          {t("admin.sources.emptyText")}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.sources.source")}</TableHead>
                <TableHead>{t("admin.sources.task")}</TableHead>
                <TableHead>{t("admin.sources.status")}</TableHead>
                <TableHead>{t("admin.sources.lastVerified")}</TableHead>
                <TableHead>{t("admin.sources.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.SourceID}>
                  <TableCell className="min-w-56 whitespace-normal">
                    <p className="font-medium">{s.SourceTitle}</p>
                    {s.SourceURL && (
                      <a href={s.SourceURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs break-all underline decoration-gold/60 underline-offset-4">
                        {s.SourceURL} <ExternalLinkIcon className="size-3" aria-hidden />
                        <span className="sr-only">({t("common.externalLink")})</span>
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal">
                    <Link href={`/admin/templates/${s.TaskID}`} className="link-accent">
                      {s.TaskTitle}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <SourceStatusBadge status={s.SourceStatus} i18n={i18n} />
                  </TableCell>
                  <TableCell>{format.date(s.LastVerifiedAt)}</TableCell>
                  <TableCell>
                    <SourceStatusForm sourceId={s.SourceID} current={s.SourceStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
