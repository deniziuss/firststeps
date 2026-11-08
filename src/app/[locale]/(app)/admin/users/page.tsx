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
import { listUsers } from "@/server/repositories/users";
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
  const users = await listUsers({ role, search: search || undefined });

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
    </div>
  );
}
