// Routine database maintenance for FirstSteps (needs proposal 0006). Dry run by default: it only
// counts and reports. With --apply it removes expired security records in small batches.
//
//   node --env-file=.env.local scripts/db/maintenance.mjs                 # report only (dry run)
//   node --env-file=.env.local scripts/db/maintenance.mjs --apply         # clean up, then report
//
// With --apply (each batch is its own short transaction, so locks stay short and a stopped run loses
// nothing; running it again simply continues: idempotent):
//   Rate_Limit_Buckets   windows that ended, via dbo.usp_RateLimit_Purge (500 rows per batch)
//   Account_Tokens       tokens used or expired more than --token-days days ago (default 7; 500 per batch)
//   Admin_Audit_Events   only through dbo.usp_AdminAudit_Purge, only with --audit-days N (N >= 365; the
//                        procedure refuses less). Without --audit-days no audit event is ever removed.
// Report (always): database size, rows and space per table, index fragmentation for indexes with at
// least 100 pages, and the age of statistics. Rebuilding indexes or updating statistics is NOT done
// here (it needs more than the application's permissions); the report says when it would help.
// Limits: at most --max-batches batches per table and run (default 50), so a run is always bounded.
// Output: one JSON line per step (maintenance_*), suitable for the log scan and scheduled runs.
import sql from "mssql";
import { loadDbConfig } from "./config.mjs";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const apply = args.includes("--apply");
const tokenDays = value("token-days", 7);
const auditDays = value("audit-days", undefined);
const maxBatches = value("max-batches", 50);
const BATCH = 500;
if (!Number.isInteger(tokenDays) || tokenDays < 1) throw new Error("--token-days must be a whole number >= 1");
if (auditDays !== undefined && (!Number.isInteger(auditDays) || auditDays < 365)) throw new Error("--audit-days must be >= 365");
if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 1000) throw new Error("--max-batches must be 1..1000");

const out = (event, data) => console.log(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
const config = loadDbConfig();
const pool = await sql.connect(config);
let failed = false;
try {
  const one = async (text, inputs = {}) => {
    const request = pool.request();
    for (const [name, [type, v]] of Object.entries(inputs)) request.input(name, type, v);
    return (await request.query(text)).recordset[0];
  };
  const tokenFilter = "(UsedAt IS NOT NULL AND UsedAt < DATEADD(DAY, -@days, SYSUTCDATETIME())) OR (UsedAt IS NULL AND ExpiresAt < DATEADD(DAY, -@days, SYSUTCDATETIME()))";
  const due = await one(
    `SELECT (SELECT COUNT(*) FROM dbo.Rate_Limit_Buckets WHERE WindowEndsAt < SYSUTCDATETIME()) AS expiredBuckets,
            (SELECT COUNT(*) FROM dbo.Rate_Limit_Buckets) AS buckets,
            (SELECT COUNT(*) FROM dbo.Account_Tokens WHERE ${tokenFilter}) AS oldTokens,
            (SELECT COUNT(*) FROM dbo.Account_Tokens) AS tokens,
            (SELECT COUNT(*) FROM dbo.Admin_Audit_Events) AS auditEvents,
            (SELECT COUNT(*) FROM dbo.Admin_Audit_Events WHERE CreatedAt < DATEADD(DAY, -@audit, SYSUTCDATETIME())) AS auditBeyondRetention,
            DB_NAME() AS db`,
    { days: [sql.Int, tokenDays], audit: [sql.Int, auditDays ?? 730] },
  );
  out("maintenance_due", { apply, tokenDays, auditDays: auditDays ?? null, ...due });

  if (apply) {
    const batches = async (label, run) => {
      let total = 0;
      for (let i = 0; i < maxBatches; i++) {
        const deleted = await run();
        total += deleted;
        if (deleted < BATCH) break;
      }
      out("maintenance_cleaned", { table: label, deleted: total });
    };
    await batches("Rate_Limit_Buckets", async () => (await pool.request().input("MaxRows", sql.Int, BATCH).execute("dbo.usp_RateLimit_Purge")).recordset[0].Deleted);
    await batches("Account_Tokens", async () =>
      (await one(`DELETE TOP (${BATCH}) FROM dbo.Account_Tokens WHERE ${tokenFilter}; SELECT @@ROWCOUNT AS Deleted;`, { days: [sql.Int, tokenDays] })).Deleted,
    );
    if (auditDays !== undefined) {
      const deleted = (await pool.request().input("KeepDays", sql.Int, auditDays).execute("dbo.usp_AdminAudit_Purge")).recordset[0].Deleted;
      out("maintenance_cleaned", { table: "Admin_Audit_Events", deleted, keepDays: auditDays });
    }
  }

  // Report: size and tables (metadata views readable with the application's permissions).
  const size = await one(`SELECT CAST(SUM(CAST(size AS BIGINT)) * 8 / 1024.0 AS DECIMAL(12,1)) AS allocatedMb FROM sys.database_files`);
  const tables = (
    await pool.request().query(`
      SELECT t.name AS name, SUM(CASE WHEN i.index_id IN (0,1) THEN p.rows ELSE 0 END) AS rows,
             CAST(SUM(a.used_pages) * 8 / 1024.0 AS DECIMAL(12,2)) AS usedMb
        FROM sys.tables t JOIN sys.indexes i ON i.object_id = t.object_id
        JOIN sys.partitions p ON p.object_id = i.object_id AND p.index_id = i.index_id
        JOIN sys.allocation_units a ON a.container_id = p.partition_id
       GROUP BY t.name ORDER BY usedMb DESC`)
  ).recordset;
  out("maintenance_size", { allocatedMb: size.allocatedMb, tables });

  // Index fragmentation and statistics age need VIEW DATABASE STATE (or VIEW DATABASE PERFORMANCE
  // STATE). The application login does not have it; the report says so instead of failing.
  try {
    const indexes = (
      await pool.request().query(`
        SELECT OBJECT_NAME(s.object_id) AS tableName, i.name AS indexName, s.page_count AS pages,
               CAST(s.avg_fragmentation_in_percent AS DECIMAL(5,1)) AS fragmentation
          FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') s
          JOIN sys.indexes i ON i.object_id = s.object_id AND i.index_id = s.index_id
         WHERE s.page_count >= 100 AND OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1`)
    ).recordset;
    const stats = (
      await pool.request().query(`
        SELECT OBJECT_NAME(s.object_id) AS tableName, s.name AS statistic, sp.last_updated AS lastUpdated, sp.rows, sp.modification_counter AS modified
          FROM sys.stats s CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
         WHERE OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1 AND sp.modification_counter > 0.2 * NULLIF(sp.rows, 0)`)
    ).recordset;
    out("maintenance_indexes", {
      checked: indexes.length,
      rebuildAdvised: indexes.filter((x) => x.fragmentation > 30),
      staleStatistics: stats,
      note: indexes.length === 0 ? "no index has 100 pages yet; fragmentation is not meaningful at this size" : undefined,
    });
  } catch (error) {
    out("maintenance_indexes", { skipped: "needs VIEW DATABASE STATE (run with an owner login to include this part)", sqlNumber: error.number });
  }
} catch (error) {
  failed = true;
  out("maintenance_failed", { message: error.message, sqlNumber: error.number });
} finally {
  await pool.close();
}
process.exitCode = failed ? 1 : 0;
