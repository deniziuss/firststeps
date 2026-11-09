import type { Metadata } from "next";
import Link from "next/link";
import { NativeSelect } from "@/components/form";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getI18n } from "@/i18n/server";
import { parseId } from "@/lib/ids";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, AUDIT_PAGE_SIZE, type AuditAction, type AuditEntity, listAuditEvents } from "@/server/audit";
import { requireRole } from "@/server/dal";
import { ScrollTextIcon } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.audit.title") };
}

// Admins only (checked on the server). Read-only: the application has no way to edit or delete events.
export default async function AuditPage({ searchParams }: PageProps<"/[locale]/admin/audit">) {
  await requireRole("Admin");
  const { t, format } = await getI18n();
  const params = await searchParams;
  const action = AUDIT_ACTIONS.find((a) => a === params.action) as AuditAction | undefined;
  const entityType = AUDIT_ENTITIES.find((e) => e === params.entity) as AuditEntity | undefined;
  const page = Math.min(parseId(params.page) ?? 1, 100_000);
  const { rows, total } = await listAuditEvents({ action, entityType, page });
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    if (entityType) query.set("entity", entityType);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return `/admin/audit${text ? `?${text}` : ""}`;
  };

  return (
    <div className="grid gap-8">
      <PageHeader title={t("admin.audit.title")} description={t("admin.audit.intro")} />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="audit-action">{t("admin.audit.action")}</Label>
          <NativeSelect id="audit-action" name="action" defaultValue={action ?? ""} className="w-64">
            <option value="">{t("admin.audit.allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`admin.audit.actions.${a}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="audit-entity">{t("admin.audit.record")}</Label>
          <NativeSelect id="audit-entity" name="entity" defaultValue={entityType ?? ""} className="w-48">
            <option value="">{t("admin.audit.allRecords")}</option>
            {AUDIT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {t(`admin.audit.entities.${e}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          {t("admin.audit.filter")}
        </Button>
      </form>

      {total === 0 ? (
        <EmptyState icon={ScrollTextIcon} title={t("admin.audit.empty")} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {t("admin.audit.showing", { from: (page - 1) * AUDIT_PAGE_SIZE + 1, to: Math.min(page * AUDIT_PAGE_SIZE, total), total })}
          </p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.audit.time")}</TableHead>
                  <TableHead>{t("admin.audit.admin")}</TableHead>
                  <TableHead>{t("admin.audit.action")}</TableHead>
                  <TableHead>{t("admin.audit.record")}</TableHead>
                  <TableHead>{t("admin.audit.details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.EventID} data-audit-action={row.Action}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{format.dateTime(row.CreatedAt)}</TableCell>
                    <TableCell>{row.AdminName}</TableCell>
                    <TableCell>{t(`admin.audit.actions.${row.Action}`)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t(`admin.audit.entities.${row.EntityType}`)}
                      {row.EntityID !== null && <span className="font-mono text-xs text-muted-foreground"> #{row.EntityID}</span>}
                    </TableCell>
                    <TableCell className="max-w-80 font-mono text-xs break-words whitespace-normal text-muted-foreground">{row.Details ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pages > 1 && (
            <nav aria-label={t("admin.audit.pagination")} className="flex items-center justify-between gap-3">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page - 1)}>{t("admin.audit.previous")}</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">{t("admin.audit.page", { page, pages })}</span>
              {page < pages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(page + 1)}>{t("admin.audit.next")}</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
