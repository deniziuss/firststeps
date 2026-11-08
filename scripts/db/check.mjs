// Read-only connection check. Only SELECT statements against system views.
// Usage: npm run db:check
import sql from "mssql";
import { withReadOnlySession } from "./config.mjs";

const EXPECTED_TABLES = [
  "Users", "Universities", "Journeys", "Task_Templates",
  "Journey_Tasks", "Task_Dependencies", "Information_Sources", "Help_Requests",
];

try {
  await withReadOnlySession(sql, async (request) => {
    const server = await request().query(`
      SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50)) AS ProductVersion,
             CAST(SERVERPROPERTY('Edition') AS NVARCHAR(100))       AS Edition,
             (SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()) AS CompatibilityLevel`);
    console.table(server.recordset);

    const counts = await request().query(`
      SELECT
        (SELECT COUNT(*) FROM sys.tables t WHERE t.schema_id = SCHEMA_ID('dbo') AND t.name IN (${EXPECTED_TABLES.map((t) => `N'${t}'`).join(",")})) AS Tables,
        (SELECT COUNT(*) FROM sys.key_constraints WHERE type = 'PK' AND OBJECT_SCHEMA_NAME(parent_object_id) = 'dbo') AS PrimaryKeys,
        (SELECT COUNT(*) FROM sys.foreign_keys WHERE OBJECT_SCHEMA_NAME(parent_object_id) = 'dbo') AS ForeignKeys,
        (SELECT COUNT(*) FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id WHERE t.is_ms_shipped = 0 AND i.name LIKE N'IX[_]%') AS IxIndexes,
        (SELECT COUNT(*) FROM sys.triggers WHERE parent_class = 1) AS Triggers,
        (SELECT COUNT(*) FROM sys.procedures WHERE schema_id = SCHEMA_ID('dbo')) AS Procedures`);
    console.table(counts.recordset);

    // What the connected login is allowed to do here (helps confirm it has no DDL rights).
    const perms = await request().query(`
      SELECT permission_name FROM fn_my_permissions(NULL, 'DATABASE') ORDER BY permission_name`);
    console.log("Database permissions for this login:", perms.recordset.map((r) => r.permission_name).join(", "));
  });
  console.log("OK: read-only check finished (transaction rolled back).");
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
}
