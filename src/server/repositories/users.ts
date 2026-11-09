import "server-only";
import type { UserRole } from "@/domain/statuses";
import { execute, type Params, procedure, query, queryOne, sql } from "../db";

export type UserRecord = {
  UserID: number;
  FirstName: string;
  LastName: string;
  Email: string;
  UserRole: UserRole;
  IsActive: boolean;
  CreatedAt: Date;
};

const USER_COLUMNS = "UserID, FirstName, LastName, Email, UserRole, IsActive, CreatedAt";

export function findUserById(userId: number) {
  return queryOne<UserRecord>(`SELECT ${USER_COLUMNS} FROM dbo.Users WHERE UserID = @userId`, { userId: [sql.Int, userId] });
}

// Only for session checks in dal.ts: the password hash never leaves the server layer.
export function findSessionUser(userId: number) {
  return queryOne<UserRecord & { PasswordHash: string; SessionVersion: number; EmailVerifiedAt: Date | null }>(`SELECT ${USER_COLUMNS}, PasswordHash, SessionVersion, EmailVerifiedAt FROM dbo.Users WHERE UserID = @userId`, {
    userId: [sql.Int, userId],
  });
}

export function findCredentialsByEmail(email: string) {
  return queryOne<{ UserID: number; PasswordHash: string; IsActive: boolean; UserRole: UserRole; SessionVersion: number }>(
    "SELECT UserID, PasswordHash, IsActive, UserRole, SessionVersion FROM dbo.Users WHERE Email = @email",
    { email: [sql.NVarChar(255), email] },
  );
}

/** Active account for a password-reset request (no hash, no personal data beyond the id). */
export function findActiveUserIdByEmail(email: string) {
  return queryOne<{ UserID: number }>("SELECT UserID FROM dbo.Users WHERE Email = @email AND IsActive = 1", { email: [sql.NVarChar(255), email] });
}

/** Contact data for sending an account email to a signed-in or token-identified user. */
export function findMailRecipient(userId: number) {
  return queryOne<{ Email: string; FirstName: string; EmailVerifiedAt: Date | null }>(
    "SELECT Email, FirstName, EmailVerifiedAt FROM dbo.Users WHERE UserID = @userId AND IsActive = 1",
    { userId: [sql.Int, userId] },
  );
}

export function markEmailVerified(userId: number) {
  return execute("UPDATE dbo.Users SET EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSUTCDATETIME()) WHERE UserID = @userId", { userId: [sql.Int, userId] });
}

/**
 * Password reset: new hash, every session ended (SessionVersion + 1), and the email counts as verified
 * (the user just proved access to it). Returns false for an inactive or unknown account.
 */
export async function resetPassword(userId: number, passwordHash: string) {
  const affected = await execute(
    `UPDATE dbo.Users
        SET PasswordHash = @passwordHash, SessionVersion = SessionVersion + 1,
            EmailVerifiedAt = COALESCE(EmailVerifiedAt, SYSUTCDATETIME())
      WHERE UserID = @userId AND IsActive = 1`,
    { userId: [sql.Int, userId], passwordHash: [sql.NVarChar(255), passwordHash] },
  );
  return affected > 0;
}

export function findPasswordHash(userId: number) {
  return queryOne<{ PasswordHash: string }>("SELECT PasswordHash FROM dbo.Users WHERE UserID = @userId", { userId: [sql.Int, userId] });
}

// Uses the course procedure, which always creates a Student and returns SCOPE_IDENTITY().
export async function createStudent(input: { firstName: string; lastName: string; email: string; passwordHash: string }) {
  const { output } = await procedure(
    "dbo.usp_User_Insert",
    {
      FirstName: [sql.NVarChar(100), input.firstName],
      LastName: [sql.NVarChar(100), input.lastName],
      Email: [sql.NVarChar(255), input.email],
      PasswordHash: [sql.NVarChar(255), input.passwordHash],
    },
    { NewUserID: sql.Int },
  );
  return output.NewUserID as number;
}

export function updateProfile(userId: number, firstName: string, lastName: string) {
  return execute("UPDATE dbo.Users SET FirstName = @firstName, LastName = @lastName WHERE UserID = @userId", {
    userId: [sql.Int, userId],
    firstName: [sql.NVarChar(100), firstName],
    lastName: [sql.NVarChar(100), lastName],
  });
}

// Session versions (migration 0004): every token carries the version it was issued with, and a
// token whose version differs from the row is rejected. Increments are single atomic statements,
// so concurrent sign-outs or password changes can never reuse a version.

/** Signs the account out everywhere. Returns the new version, or undefined for an unknown user. */
export async function bumpSessionVersion(userId: number) {
  const row = await queryOne<{ SessionVersion: number }>(
    "UPDATE dbo.Users SET SessionVersion = SessionVersion + 1 OUTPUT inserted.SessionVersion WHERE UserID = @userId",
    { userId: [sql.Int, userId] },
  );
  return row?.SessionVersion;
}

/** Stores the new hash and invalidates every existing session in the same statement. */
export async function updatePasswordHash(userId: number, passwordHash: string) {
  const row = await queryOne<{ SessionVersion: number }>(
    "UPDATE dbo.Users SET PasswordHash = @passwordHash, SessionVersion = SessionVersion + 1 OUTPUT inserted.SessionVersion WHERE UserID = @userId",
    { userId: [sql.Int, userId], passwordHash: [sql.NVarChar(255), passwordHash] },
  );
  if (!row) throw new Error("User not found while changing the password");
  return row.SessionVersion;
}

// Admin views never select PasswordHash. Paged, because the user table grows with every student.
// LIKE wildcards typed into the search box are escaped, so "%" or "_" match literally.
export const USERS_PAGE_SIZE = 50;

export function escapeLike(value: string) {
  return value.replace(/[!%_[]/g, (char) => `!${char}`);
}

export async function listUsers(filter: { role?: UserRole; search?: string; page?: number }) {
  const page = Math.max(1, filter.page ?? 1);
  const pattern = filter.search ? `%${escapeLike(filter.search)}%` : null;
  const where = `WHERE (@role IS NULL OR UserRole = @role)
        AND (@search IS NULL OR Email LIKE @search ESCAPE '!' OR FirstName LIKE @search ESCAPE '!' OR LastName LIKE @search ESCAPE '!')`;
  const params: Params = {
    role: [sql.NVarChar(20), filter.role ?? null],
    search: [sql.NVarChar(260), pattern],
    offset: [sql.Int, (page - 1) * USERS_PAGE_SIZE],
    size: [sql.Int, USERS_PAGE_SIZE],
  };
  const [rows, total] = await Promise.all([
    query<UserRecord>(`SELECT ${USER_COLUMNS} FROM dbo.Users ${where} ORDER BY CreatedAt DESC, UserID DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`, params),
    queryOne<{ Total: number }>(`SELECT COUNT(*) AS Total FROM dbo.Users ${where}`, params),
  ]);
  return { rows, total: total?.Total ?? 0, page };
}

export function listActiveMentors() {
  return query<Pick<UserRecord, "UserID" | "FirstName" | "LastName" | "UserRole">>(
    "SELECT UserID, FirstName, LastName, UserRole FROM dbo.Users WHERE IsActive = 1 AND UserRole IN (N'Mentor', N'Admin') ORDER BY FirstName, LastName",
  );
}

// A role or active-state change also ends the user's sessions; saving unchanged values does not.
export function setUserRoleAndStatus(userId: number, role: UserRole, isActive: boolean) {
  return execute(
    `UPDATE dbo.Users
        SET SessionVersion = SessionVersion + CASE WHEN UserRole <> @role OR IsActive <> @isActive THEN 1 ELSE 0 END,
            UserRole = @role, IsActive = @isActive
      WHERE UserID = @userId`, {
    userId: [sql.Int, userId],
    role: [sql.NVarChar(20), role],
    isActive: [sql.Bit, isActive],
  });
}
