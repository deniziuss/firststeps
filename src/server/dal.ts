import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/domain/statuses";
import { findUserById } from "./repositories/users";
import { readSession } from "./session";

export type CurrentUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};

export const HOME_BY_ROLE: Record<UserRole, string> = {
  Student: "/dashboard",
  Mentor: "/mentor",
  Admin: "/admin",
};

// The session only carries the user id. Role and active state are read from the database on
// every request, so a deactivated or re-assigned account takes effect immediately.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user || !user.IsActive) return null;
  return { id: user.UserID, firstName: user.FirstName, lastName: user.LastName, email: user.Email, role: user.UserRole };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(HOME_BY_ROLE[user.role]);
  return user;
}
