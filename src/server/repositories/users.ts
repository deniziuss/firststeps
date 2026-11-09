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
  return queryOne<UserRecord & { PasswordHash: string }>(`SELECT ${USER_COLUMNS}, PasswordHash FROM dbo.Users WHERE UserID = @userId`, {
    userId: [sql.Int, userId],
  });
}

export function findCredentialsByEmail(email: string) {
  return queryOne<{ UserID: number; PasswordHash: string; IsActive: boolean; UserRole: UserRole }>(
    "SELECT UserID, PasswordHash, IsActive, UserRole FROM dbo.Users WHERE Email = @email",
    { email: [sql.NVarChar(255), email] },
  );
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

export async function updatePasswordHash(userId: number, passwordHash: string) {
  return execute("UPDATE dbo.Users SET PasswordHash = @passwordHash WHERE UserID = @userId", {
    userId: [sql.Int, userId],
    passwordHash: [sql.NVarChar(255), passwordHash],
  });
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

export function setUserRoleAndStatus(userId: number, role: UserRole, isActive: boolean) {
  return execute("UPDATE dbo.Users SET UserRole = @role, IsActive = @isActive WHERE UserID = @userId", {
    userId: [sql.Int, userId],
    role: [sql.NVarChar(20), role],
    isActive: [sql.Bit, isActive],
  });
}
