import type { Metadata } from "next";
import { formatDate, PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { USER_ROLES, type UserRole } from "@/domain/statuses";
import { requireRole } from "@/server/dal";
import { listUsers } from "@/server/repositories/users";
import { UserForm } from "./user-form";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const current = await requireRole("Admin");
  const params = await searchParams;
  const role = USER_ROLES.find((r) => r === params.role) as UserRole | undefined;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : undefined;
  const users = await listUsers({ role, search: search || undefined });

  return (
    <div className="grid gap-6">
      <PageHeader title="Users" description="Change roles and deactivate accounts. Passwords are never shown or stored in readable form." />
      <form className="flex flex-wrap gap-2" role="search">
        <Input name="q" defaultValue={search} placeholder="Search name or email" className="w-64" aria-label="Search users" />
        <select name="role" defaultValue={role ?? ""} aria-label="Role" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30">
          <option value="">All roles</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" className="h-8 rounded-lg border px-3 text-sm hover:bg-muted">
          Filter
        </button>
      </form>
      <Card>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Role and access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.UserID}>
                  <TableCell className="font-medium">
                    {u.FirstName} {u.LastName}
                    {u.UserID === current.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell>{u.Email}</TableCell>
                  <TableCell>{formatDate(u.CreatedAt)}</TableCell>
                  <TableCell>
                    <UserForm userId={u.UserID} role={u.UserRole} isActive={u.IsActive} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
