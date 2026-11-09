import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { UserRole } from "@/domain/statuses";
import { findSessionUser } from "./repositories/users";
import { passwordFingerprint, readSession } from "./session";

export type CurrentUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  /** False until the owner confirms the email address (accounts created before 0006 count as verified). */
  emailVerified: boolean;
};

export const HOME_BY_ROLE: Record<UserRole, string> = {
  Student: "/dashboard",
  Mentor: "/mentor",
  Admin: "/admin",
};

// The session carries the user id, the session version and a password fingerprint. Every request
// reads the user row: an inactive account, a different SessionVersion (sign-out, password change,
// role or status change) or a different password hash all reject the token immediately.
// cache() is per request only; nothing user-specific is cached across requests.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await findSessionUser(session.userId);
  if (!user || !user.IsActive) return null;
  if (user.SessionVersion !== session.sv) return null;
  if (passwordFingerprint(user.PasswordHash) !== session.pv) return null;
  return { id: user.UserID, firstName: user.FirstName, lastName: user.LastName, email: user.Email, role: user.UserRole, emailVerified: user.EmailVerifiedAt !== null };
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
