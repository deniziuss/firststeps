import "server-only";
import type { UserRole } from "@/domain/statuses";
import { execute, procedure, query, queryOne, sql } from "../db";

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

export function findCredentialsByEmail(email: string) {
  return queryOne<{ UserID: number; PasswordHash: string; IsActive: boolean }>(
    "SELECT UserID, PasswordHash, IsActive FROM dbo.Users WHERE Email = @email",
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

export function updatePasswordHash(userId: number, passwordHash: string) {
  return execute("UPDATE dbo.Users SET PasswordHash = @passwordHash WHERE UserID = @userId", {
    userId: [sql.Int, userId],
    passwordHash: [sql.NVarChar(255), passwordHash],
  });
}

// Admin views never select PasswordHash.
export function listUsers(filter: { role?: UserRole; search?: string }) {
  return query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM dbo.Users
      WHERE (@role IS NULL OR UserRole = @role)
        AND (@search IS NULL OR Email LIKE @search OR FirstName LIKE @search OR LastName LIKE @search)
      ORDER BY CreatedAt DESC`,
    {
      role: [sql.NVarChar(20), filter.role ?? null],
      search: [sql.NVarChar(260), filter.search ? `%${filter.search}%` : null],
    },
  );
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
