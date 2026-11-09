import { parseId } from "@/lib/ids";
import type { Metadata } from "next";
import { NativeSelect } from "@/components/form";
import { PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { USER_ROLES, type UserRole } from "@/domain/statuses";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import Link from "next/link";
import { listUsers, USERS_PAGE_SIZE } from "@/server/repositories/users";
import { UserForm } from "./user-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.users.title") };
}

export default async function UsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const current = await requireRole("Admin");
  const { t, format } = await getI18n();
  const params = await searchParams;
  const role = USER_ROLES.find((r) => r === params.role) as UserRole | undefined;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : undefined;
  // Out-of-range pages fall back to the first page (and never reach SQL as an overflowing OFFSET).
  const requestedPage = Math.min(parseId(params.page) ?? 1, 100_000);
  const { rows: users, total, page } = await listUsers({ role, search: search || undefined, page: requestedPage });
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (role) query.set("role", role);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return `/admin/users${text ? `?${text}` : ""}`;
  };

  return (
    <div className="grid gap-8">
      <PageHeader title={t("admin.users.title")} description={t("admin.users.intro")} />
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div className="grid gap-1">
          <Label htmlFor="user-search">{t("admin.users.search")}</Label>
          <Input id="user-search" name="q" defaultValue={search} className="w-72 max-w-full" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="user-role">{t("admin.users.role")}</Label>
          <NativeSelect id="user-role" name="role" defaultValue={role ?? ""} className="w-44">
            <option value="">{t("admin.users.allRoles")}</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          {t("admin.users.filter")}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground" role="status">
        {total === 0
          ? t("admin.users.noResults")
          : t("admin.users.showing", { from: (page - 1) * USERS_PAGE_SIZE + 1, to: Math.min(page * USERS_PAGE_SIZE, total), total })}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.users.name")}</TableHead>
              <TableHead>{t("admin.users.email")}</TableHead>
              <TableHead>{t("admin.users.joined")}</TableHead>
              <TableHead>{t("admin.users.access")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.UserID}>
                <TableCell className="font-medium">
                  {u.FirstName} {u.LastName}
                  {u.UserID === current.id && <span className="ml-1 text-sm text-muted-foreground">{t("admin.users.you")}</span>}
                </TableCell>
                <TableCell>{u.Email}</TableCell>
                <TableCell>{format.date(u.CreatedAt)}</TableCell>
                <TableCell>
                  <UserForm userId={u.UserID} name={`${u.FirstName} ${u.LastName}`} role={u.UserRole} isActive={u.IsActive} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <nav aria-label={t("admin.users.pagination")} className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>{t("admin.users.previous")}</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">{t("admin.users.page", { page, pages })}</span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>{t("admin.users.next")}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
