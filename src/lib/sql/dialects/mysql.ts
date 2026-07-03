import { SqlDialect } from "./dialect";
import { SchemaModel, TableModel } from "../../schema/parser";
import { SchemaDiff } from "../../diff/schemaDiff";
import { parseSqlDdlText } from "../parserHelper";

function generateMysqlCreateTableSQL(table: TableModel): string {
  const columnDefs: string[] = [];
  const pkCols = table.columns.filter((c) => c.pk);
  const isCompositePK = pkCols.length > 1;

  table.columns.forEach((col) => {
    let def = `\`${col.name}\` ${col.type || "VARCHAR(255)"}`;

    if (col.notNull) {
      def += " NOT NULL";
    }
    if (col.pk && !isCompositePK) {
      if (col.type.toUpperCase().includes("INT")) {
        def += " AUTO_INCREMENT";
      }
      def += " PRIMARY KEY";
    }
    if (col.unique && !col.pk) {
      def += " UNIQUE";
    }
    if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal.trim() !== "") {
      def += ` DEFAULT ${col.defaultVal}`;
    }
    columnDefs.push(def);
  });

  if (isCompositePK) {
    const colNames = pkCols.map((c) => `\`${c.name}\``).join(", ");
    columnDefs.push(`PRIMARY KEY (${colNames})`);
  }

  table.foreignKeys.forEach((fk) => {
    columnDefs.push(
      `FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\` (\`${fk.refColumn}\`) ON UPDATE CASCADE ON DELETE SET NULL`
    );
  });

  return `CREATE TABLE \`${table.name}\` (\n  ${columnDefs.join(",\n  ")}\n);`;
}

export class MysqlDialect implements SqlDialect {
  id = "mysql";
  name = "MySQL";

  async parse(sql: string): Promise<SchemaModel> {
    return parseSqlDdlText(sql);
  }

  generateDDL(diff: SchemaDiff): string[] {
    const statements: string[] = [];

    // 1. Drop removed tables
    diff.removedTables.forEach((tbl) => {
      statements.push(`DROP TABLE \`${tbl.replace(/`/g, "``")}\`;`);
    });

    // 2. Create added tables
    diff.addedTables.forEach((table) => {
      statements.push(generateMysqlCreateTableSQL(table));
    });

    // 3. Modify existing tables
    Object.values(diff.modifiedTables).forEach((mod) => {
      const tName = mod.tableName;
      const qTable = `\`${tName.replace(/`/g, "``")}\``;

      // 3a. Remove columns
      mod.removedColumns.forEach((col) => {
        statements.push(`ALTER TABLE ${qTable} DROP COLUMN \`${col.replace(/`/g, "``")}\`;`);
      });

      // 3b. Add columns
      mod.addedColumns.forEach((col) => {
        let def = `ALTER TABLE ${qTable} ADD COLUMN \`${col.name.replace(/`/g, "``")}\` ${col.type}`;
        if (col.notNull) def += " NOT NULL";
        if (col.unique) def += " UNIQUE";
        if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal.trim() !== "") {
          def += ` DEFAULT ${col.defaultVal}`;
        }
        statements.push(def + ";");
      });

      // 3c. Modify columns (MySQL changes type, nullability, and defaults under MODIFY COLUMN statement)
      mod.modifiedColumns.forEach((colMod) => {
        const qCol = `\`${colMod.columnName.replace(/`/g, "``")}\``;
        const col = colMod.newColumn;
        
        let def = `ALTER TABLE ${qTable} MODIFY COLUMN ${qCol} ${col.type}`;
        if (col.notNull) def += " NOT NULL";
        if (col.unique) def += " UNIQUE";
        if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal.trim() !== "") {
          def += ` DEFAULT ${col.defaultVal}`;
        }
        statements.push(def + ";");
      });

      // 3d. Remove Foreign Keys
      mod.removedForeignKeys.forEach((fk) => {
        const constraintName = `fk_${tName}_${fk.column}`;
        statements.push(`ALTER TABLE ${qTable} DROP FOREIGN KEY \`${constraintName}\`;`);
      });

      // 3e. Add Foreign Keys
      mod.addedForeignKeys.forEach((fk) => {
        const constraintName = `fk_${tName}_${fk.column}`;
        statements.push(
          `ALTER TABLE ${qTable} ADD CONSTRAINT \`${constraintName}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\` (\`${fk.refColumn}\`) ON UPDATE CASCADE ON DELETE SET NULL;`
        );
      });
    });

    return statements;
  }
}
