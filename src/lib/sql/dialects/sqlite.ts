import { SqlDialect } from "./dialect";
import { SchemaModel } from "../../schema/parser";
import { SchemaDiff } from "../../diff/schemaDiff";
import { parseSqlDdlText } from "../parserHelper";
import { generateCreateTableSQL, generateTableMigrationSQL } from "../../schema/ddl";

export class SqliteDialect implements SqlDialect {
  id = "sqlite";
  name = "SQLite";

  async parse(sql: string): Promise<SchemaModel> {
    return parseSqlDdlText(sql);
  }

  generateDDL(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    // 1. Drop tables (children first, but in SQLite we just run DROP TABLE)
    diff.removedTables.forEach((tbl) => {
      statements.push(`DROP TABLE "${tbl.replace(/"/g, '""')}";`);
    });

    // 2. Create added tables
    diff.addedTables.forEach((table) => {
      statements.push(generateCreateTableSQL(table));
    });

    // 3. Migrate modified tables (delegates to the transaction recreation generator)
    Object.values(diff.modifiedTables).forEach((mod) => {
      const migrateStmts = generateTableMigrationSQL(mod.sourceTable, mod.targetTable);
      statements.push(...migrateStmts);
    });

    return statements;
  }
}
