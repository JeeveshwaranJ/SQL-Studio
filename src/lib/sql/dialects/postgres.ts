import { SqlDialect } from "./dialect";
import { SchemaModel, TableModel } from "../../schema/parser";
import { SchemaDiff } from "../../diff/schemaDiff";
import { parseSqlDdlText } from "../parserHelper";

function generatePostgresCreateTableSQL(table: TableModel): string {
  const columnDefs: string[] = [];
  const pkCols = table.columns.filter((c) => c.pk);
  const isCompositePK = pkCols.length > 1;

  table.columns.forEach((col) => {
    let type = col.type;
    // Map integer PK to SERIAL in Postgres for autoIncrement behavior
    if (col.pk && !isCompositePK && (type.toUpperCase().includes("INT") || type === "")) {
      type = "SERIAL";
    }
    
    let def = `"${col.name}" ${type}`;

    if (col.pk && !isCompositePK) {
      def += " PRIMARY KEY";
    }
    if (col.notNull && !col.pk) {
      def += " NOT NULL";
    }
    if (col.unique && !col.pk) {
      def += " UNIQUE";
    }
    if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal.trim() !== "") {
      if (type !== "SERIAL") {
        def += ` DEFAULT ${col.defaultVal}`;
      }
    }
    columnDefs.push(def);
  });

  if (isCompositePK) {
    const colNames = pkCols.map((c) => `"${c.name}"`).join(", ");
    columnDefs.push(`PRIMARY KEY (${colNames})`);
  }

  table.foreignKeys.forEach((fk) => {
    columnDefs.push(
      `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}" ("${fk.refColumn}") ON UPDATE CASCADE ON DELETE SET NULL`
    );
  });

  return `CREATE TABLE "${table.name}" (\n  ${columnDefs.join(",\n  ")}\n);`;
}

export class PostgresDialect implements SqlDialect {
  id = "postgres";
  name = "PostgreSQL";

  async parse(sql: string): Promise<SchemaModel> {
    return parseSqlDdlText(sql);
  }

  generateDDL(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    // 1. Drop removed tables (Cascade dropped constraints)
    diff.removedTables.forEach((tbl) => {
      statements.push(`DROP TABLE "${tbl.replace(/"/g, '""')}" CASCADE;`);
    });

    // 2. Create added tables
    diff.addedTables.forEach((table) => {
      statements.push(generatePostgresCreateTableSQL(table));
    });

    // 3. Modify existing tables
    Object.values(diff.modifiedTables).forEach((mod) => {
      const tName = mod.tableName;
      const qTable = `"${tName.replace(/"/g, '""')}"`;

      // 3a. Remove columns
      mod.removedColumns.forEach((col) => {
        statements.push(`ALTER TABLE ${qTable} DROP COLUMN "${col.replace(/"/g, '""')}";`);
      });

      // 3b. Add columns
      mod.addedColumns.forEach((col) => {
        let def = `ALTER TABLE ${qTable} ADD COLUMN "${col.name.replace(/"/g, '""')}" ${col.type}`;
        if (col.notNull) def += " NOT NULL";
        if (col.unique) def += " UNIQUE";
        if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal.trim() !== "") {
          def += ` DEFAULT ${col.defaultVal}`;
        }
        statements.push(def + ";");
      });

      // 3c. Modify columns details
      mod.modifiedColumns.forEach((colMod) => {
        const qCol = `"${colMod.columnName.replace(/"/g, '""')}"`;

        if (colMod.typeChanged) {
          statements.push(`ALTER TABLE ${qTable} ALTER COLUMN ${qCol} TYPE ${colMod.newColumn.type};`);
        }
        if (colMod.nullabilityChanged) {
          if (colMod.newColumn.notNull) {
            statements.push(`ALTER TABLE ${qTable} ALTER COLUMN ${qCol} SET NOT NULL;`);
          } else {
            statements.push(`ALTER TABLE ${qTable} ALTER COLUMN ${qCol} DROP NOT NULL;`);
          }
        }
        if (colMod.defaultChanged) {
          if (colMod.newColumn.defaultVal !== null && colMod.newColumn.defaultVal !== undefined) {
            statements.push(`ALTER TABLE ${qTable} ALTER COLUMN ${qCol} SET DEFAULT ${colMod.newColumn.defaultVal};`);
          } else {
            statements.push(`ALTER TABLE ${qTable} ALTER COLUMN ${qCol} DROP DEFAULT;`);
          }
        }
      });

      // 3d. Remove Foreign Keys
      mod.removedForeignKeys.forEach((fk) => {
        // Construct typical constraint name
        const constraintName = `fk_${tName}_${fk.column}`;
        statements.push(`ALTER TABLE ${qTable} DROP CONSTRAINT "${constraintName}";`);
      });

      // 3e. Add Foreign Keys
      mod.addedForeignKeys.forEach((fk) => {
        const constraintName = `fk_${tName}_${fk.column}`;
        statements.push(
          `ALTER TABLE ${qTable} ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}" ("${fk.refColumn}") ON UPDATE CASCADE ON DELETE SET NULL;`
        );
      });
    });

    return statements;
  }
}
