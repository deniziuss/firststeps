// Read-only schema snapshot: writes the live schema (no row data) to docs/db-snapshot/.
// Usage: npm run db:snapshot
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sql from "mssql";
import { withReadOnlySession } from "./config.mjs";

const OUT_DIR = path.resolve(process.env.SNAPSHOT_DIR ?? "docs/db-snapshot");

const QUERIES = {
  columns: `
    SELECT t.name AS TableName, c.column_id AS Position, c.name AS ColumnName,
           ty.name AS DataType, c.max_length AS MaxLength, c.precision AS Precision, c.scale AS Scale,
           c.is_nullable AS IsNullable, c.is_identity AS IsIdentity,
           dc.definition AS DefaultDefinition
      FROM sys.tables t
      JOIN sys.columns c ON c.object_id = t.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
     WHERE t.schema_id = SCHEMA_ID('dbo')
     ORDER BY t.name, c.column_id`,
  keys: `
    SELECT OBJECT_NAME(kc.parent_object_id) AS TableName, kc.name AS ConstraintName, kc.type_desc AS Type,
           ic.key_ordinal AS KeyOrdinal, c.name AS ColumnName
      FROM sys.key_constraints kc
      JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
     WHERE OBJECT_SCHEMA_NAME(kc.parent_object_id) = 'dbo'
     ORDER BY TableName, ConstraintName, KeyOrdinal`,
  foreignKeys: `
    SELECT fk.name AS ForeignKeyName,
           OBJECT_NAME(fk.parent_object_id) AS ChildTable, pc.name AS ChildColumn,
           OBJECT_NAME(fk.referenced_object_id) AS ParentTable, rc.name AS ParentColumn,
           fk.delete_referential_action_desc AS OnDelete, fk.is_disabled AS IsDisabled
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
      JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
     ORDER BY ChildTable, ForeignKeyName`,
  checkConstraints: `
    SELECT OBJECT_NAME(parent_object_id) AS TableName, name AS ConstraintName, definition AS Definition,
           is_disabled AS IsDisabled
      FROM sys.check_constraints
     ORDER BY TableName, ConstraintName`,
  indexes: `
    SELECT OBJECT_NAME(i.object_id) AS TableName, i.name AS IndexName, i.type_desc AS Type,
           i.is_unique AS IsUnique, i.is_primary_key AS IsPrimaryKey,
           ic.key_ordinal AS KeyOrdinal, ic.is_included_column AS IsIncluded, c.name AS ColumnName
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
     WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1 AND i.name IS NOT NULL
     ORDER BY TableName, IndexName, KeyOrdinal`,
  rowCounts: `
    SELECT t.name AS TableName, SUM(p.rows) AS TotalRows
      FROM sys.tables t
      JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
     WHERE t.schema_id = SCHEMA_ID('dbo')
     GROUP BY t.name
     ORDER BY t.name`,
  modules: `
    SELECT o.name AS ObjectName, o.type_desc AS Type, OBJECT_NAME(tr.parent_id) AS ParentTable,
           tr.is_disabled AS IsDisabled, o.modify_date AS ModifiedAt, m.definition AS Definition
      FROM sys.objects o
      JOIN sys.sql_modules m ON m.object_id = o.object_id
      LEFT JOIN sys.triggers tr ON tr.object_id = o.object_id
     WHERE o.schema_id = SCHEMA_ID('dbo') AND o.type IN ('P', 'TR', 'FN', 'IF', 'TF', 'V')
     ORDER BY o.type_desc, o.name`,
};

try {
  const snapshot = await withReadOnlySession(sql, async (request) => {
    const result = { takenAt: new Date().toISOString() };
    for (const [key, query] of Object.entries(QUERIES)) {
      result[key] = (await request().query(query)).recordset;
    }
    return result;
  });

  await mkdir(path.join(OUT_DIR, "modules"), { recursive: true });
  const { modules, ...structure } = snapshot;
  await writeFile(path.join(OUT_DIR, "schema.json"), JSON.stringify(structure, null, 2));
  for (const m of modules) {
    await writeFile(path.join(OUT_DIR, "modules", `${m.ObjectName}.sql`), m.Definition.trim() + "\n");
  }
  await writeFile(
    path.join(OUT_DIR, "modules", "_index.json"),
    JSON.stringify(
      modules.map((m) => ({ ObjectName: m.ObjectName, Type: m.Type, ParentTable: m.ParentTable, IsDisabled: m.IsDisabled, ModifiedAt: m.ModifiedAt })),
      null,
      2,
    ),
  );

  console.log(`OK: snapshot written to ${OUT_DIR} (${modules.length} modules, transaction rolled back).`);
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
}
