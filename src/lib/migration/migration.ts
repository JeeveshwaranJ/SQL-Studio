import { SchemaModel } from "../schema/parser";
import { SchemaDiff } from "../diff/schemaDiff";
import { SqliteDialect } from "../sql/dialects/sqlite";
import { PostgresDialect } from "../sql/dialects/postgres";
import { MysqlDialect } from "../sql/dialects/mysql";
import { createNewDatabase } from "../db/sqlite";
import { generateCreateTableSQL } from "../schema/ddl";

/**
 * Route DDL generator based on active dialect engine.
 */
export function generateMigrationSQL(diff: SchemaDiff, dialectId: string): string[] {
  switch (dialectId) {
    case "postgres":
      return new PostgresDialect().generateDDL(diff);
    case "mysql":
      return new MysqlDialect().generateDDL(diff);
    case "sqlite":
    default:
      return new SqliteDialect().generateDDL(diff);
  }
}

/**
 * Scans schema difference for destructive DDL modifications.
 */
export function detectDestructiveOperations(diff: SchemaDiff): string[] {
  const warnings: string[] = [];

  // Table drops
  diff.removedTables.forEach((tbl) => {
    warnings.push(`Dropping table "${tbl}" will delete all existing data rows permanently.`);
  });

  // Column drops or modifications
  Object.values(diff.modifiedTables).forEach((mod) => {
    mod.removedColumns.forEach((col) => {
      warnings.push(`Table "${mod.tableName}": Dropping column "${col}" will delete all cell records permanently.`);
    });

    mod.modifiedColumns.forEach((colMod) => {
      if (colMod.typeChanged) {
        warnings.push(
          `Table "${mod.tableName}": Changing data type of column "${colMod.columnName}" from "${colMod.oldColumn.type}" to "${colMod.newColumn.type}" may cause data conversion failure or type narrowing.`
        );
      }
      if (colMod.nullabilityChanged && colMod.newColumn.notNull) {
        warnings.push(
          `Table "${mod.tableName}": Adding NOT NULL constraint to column "${colMod.columnName}" will fail if existing rows contain NULL values.`
        );
      }
    });
  });

  return warnings;
}

/**
 * Dry-runs migration statements against a throwaway SQLite WASM instance.
 */
export async function dryRunMigration(
  sourceSchema: SchemaModel,
  migrationStatements: string[],
  dialectId: string
): Promise<{ success: boolean; error: string | null }> {
  const db = await createNewDatabase();

  try {
    // 1. Seed the temporary database with the source schema structures
    for (const table of sourceSchema.tables) {
      const createSql = generateCreateTableSQL(table);
      db.run(createSql);
    }

    // 2. Preprocess and execute migration statements
    for (const stmt of migrationStatements) {
      let runStmt = stmt.trim();
      if (!runStmt || runStmt === ";") continue;

      if (dialectId !== "sqlite") {
        // Coerce PostgreSQL / MySQL syntax for sql.js compatibility
        runStmt = runStmt.replace(/CASCADE/gi, "");
        runStmt = runStmt.replace(/ALTER\s+COLUMN\s+["`]?(\w+)["`]?\s+TYPE\s+\w+/gi, "");
        runStmt = runStmt.replace(/SET\s+NOT\s+NULL/gi, "");
        runStmt = runStmt.replace(/DROP\s+NOT\s+NULL/gi, "");
        runStmt = runStmt.replace(/DROP\s+DEFAULT/gi, "");
        runStmt = runStmt.replace(/SET\s+DEFAULT.*/gi, "");
        runStmt = runStmt.replace(/DROP\s+FOREIGN\s+KEY.*/gi, "");
        runStmt = runStmt.replace(/DROP\s+CONSTRAINT.*/gi, "");
        runStmt = runStmt.replace(/ADD\s+CONSTRAINT.*/gi, "");
        
        // MySQL ALTER COLUMN type uses MODIFY COLUMN, skip it in SQLite dry run
        if (runStmt.toUpperCase().includes("MODIFY COLUMN")) {
          continue;
        }
      }

      try {
        db.run(runStmt);
      } catch (e: unknown) {
        const errVal = e as any;
        const errMsg = errVal?.message || String(e);
        // Ignore syntax issues arising from PG/MySQL-specific keywords in best-effort dry runs
        if (dialectId === "sqlite" || !errMsg.toLowerCase().includes("syntax error")) {
          throw e;
        }
      }
    }

    db.close();
    return { success: true, error: null };
  } catch (err: unknown) {
    db.close();
    const errVal = err as any;
    return { success: false, error: errVal?.message || String(err) };
  }
}
