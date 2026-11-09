import "server-only";
import { execute, type Params, query, queryOne, sql, withTransaction } from "./db";
import { log } from "./log";

/**
 * Admin audit log (migration 0006, dbo.Admin_Audit_Events).
 *
 * audited() runs an administrative change and writes its audit event in ONE transaction: the event is
 * stored only if the change commits, and a failed or rolled-back change leaves no event. Repository
 * calls inside `work` join the transaction automatically (db.ts). Rows are append-only: the database
 * refuses updates and deletes outside the retention procedure.
 *
 * Details are minimal and must never hold passwords, hashes, tokens, emails or names of students:
 * only ids, enum values and short content titles. Keys that look secret are dropped.
 */
export const AUDIT_ACTIONS = [
  "user_update",
  "university_create",
  "university_update",
  "template_create",
  "template_update",
  "template_translation",
  "dependency_add",
  "dependency_remove",
  "source_add",
  "source_status",
  "source_delete",
  "mentor_assign",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export const AUDIT_ENTITIES = ["User", "University", "TaskTemplate", "Dependency", "InformationSource", "HelpRequest"] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];
type Details = Record<string, string | number | boolean | null>;

const FORBIDDEN_KEYS = /password|hash|token|secret|email|session|cookie/i;

export function auditDetails(details: Details | undefined): string | null {
  if (!details) return null;
  const safe = Object.fromEntries(Object.entries(details).filter(([key]) => !FORBIDDEN_KEYS.test(key)));
  const text = JSON.stringify(safe);
  return text.length > 1000 ? `${text.slice(0, 997)}...` : text;
}

export async function audited<T>(
  adminUserId: number,
  event: { action: AuditAction; entityType: AuditEntity; entityId?: number | ((result: T) => number | undefined); details?: Details },
  work: () => Promise<T>,
): Promise<T> {
  const result = await withTransaction(async () => {
    const value = await work();
    const entityId = typeof event.entityId === "function" ? event.entityId(value) : event.entityId;
    await execute(
      `INSERT INTO dbo.Admin_Audit_Events (AdminUserID, Action, EntityType, EntityID, Details)
       VALUES (@admin, @action, @entityType, @entityId, @details)`,
      {
        admin: [sql.Int, adminUserId],
        action: [sql.VarChar(40), event.action],
        entityType: [sql.VarChar(30), event.entityType],
        entityId: [sql.Int, entityId ?? null],
        details: [sql.NVarChar(1000), auditDetails(event.details)],
      },
    );
    return value;
  });
  void log("info", "admin", "admin_change", { adminUserId, action: event.action, entityType: event.entityType });
  return result;
}

export type AuditRow = {
  EventID: number;
  EventUid: string;
  CreatedAt: Date;
  AdminUserID: number;
  AdminName: string;
  Action: AuditAction;
  EntityType: AuditEntity;
  EntityID: number | null;
  Details: string | null;
};

export const AUDIT_PAGE_SIZE = 50;

export async function listAuditEvents(filter: { action?: AuditAction; entityType?: AuditEntity; page: number }) {
  const where = "WHERE (@action IS NULL OR e.Action = @action) AND (@entityType IS NULL OR e.EntityType = @entityType)";
  const params: Params = {
    action: [sql.VarChar(40), filter.action ?? null],
    entityType: [sql.VarChar(30), filter.entityType ?? null],
    offset: [sql.Int, (filter.page - 1) * AUDIT_PAGE_SIZE],
    size: [sql.Int, AUDIT_PAGE_SIZE],
  };
  // Sequential on purpose: the two queries may run inside a request that already holds a transaction.
  const rows = await query<AuditRow>(
    `SELECT e.EventID, e.EventUid, e.CreatedAt, e.AdminUserID, CONCAT(u.FirstName, N' ', u.LastName) AS AdminName,
            e.Action, e.EntityType, e.EntityID, e.Details
       FROM dbo.Admin_Audit_Events e JOIN dbo.Users u ON u.UserID = e.AdminUserID
      ${where}
      ORDER BY e.CreatedAt DESC, e.EventID DESC
      OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
    { ...params },
  );
  const total = await queryOne<{ Total: number }>(`SELECT COUNT(*) AS Total FROM dbo.Admin_Audit_Events e ${where}`, { ...params });
  return { rows, total: total?.Total ?? 0 };
}
