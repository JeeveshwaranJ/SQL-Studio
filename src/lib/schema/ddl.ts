import { TableModel } from "./parser";

/**
 * Generates the CREATE TABLE DDL string for a given TableModel.
 */
export function generateCreateTableSQL(table: TableModel): string {
  const columnDefs: string[] = [];

  // Determine if there is a composite primary key
  const pkCols = table.columns.filter((c) => c.pk);
  const isCompositePK = pkCols.length > 1;

  table.columns.forEach((col) => {
    let def = `"${col.name}" ${col.type || "TEXT"}`;

    // Single primary key constraint inline
    if (col.pk && !isCompositePK) {
      def += " PRIMARY KEY";
      if (col.type.toUpperCase() === "INTEGER") {
        def += " AUTOINCREMENT";
      }
    }

    if (col.notNull) {
      def += " NOT NULL";
    }

    if (col.unique && !col.pk) {
      def += " UNIQUE";
    }

    if (col.defaultVal !== null && col.defaultVal !== undefined && col.defaultVal.trim() !== "") {
      def += ` DEFAULT ${col.defaultVal}`;
    }

    columnDefs.push(def);
  });

  // Table-level constraints

  // 1. Composite Primary Key
  if (isCompositePK) {
    const colNames = pkCols.map((c) => `"${c.name}"`).join(", ");
    columnDefs.push(`PRIMARY KEY (${colNames})`);
  }

  // 2. Foreign Keys
  table.foreignKeys.forEach((fk) => {
    columnDefs.push(
      `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}" ("${fk.refColumn}") ON UPDATE CASCADE ON DELETE SET NULL`
    );
  });

  // 3. CHECK Constraints
  if (table.checkConstraints && table.checkConstraints.length > 0) {
    table.checkConstraints.forEach((check) => {
      if (check.trim()) {
        columnDefs.push(`CHECK (${check})`);
      }
    });
  }

  return `CREATE TABLE "${table.name}" (\n  ${columnDefs.join(",\n  ")}\n);`;
}

/**
 * Generates a list of SQLite commands to migrate an old table schema to a new one
 * using the transaction-wrapped temporary table recreation strategy.
 * This handles modifications like renaming columns, toggling PKs/Uniques, dropping columns,
 * modifying foreign keys, or renaming tables.
 */
export function generateTableMigrationSQL(oldTable: TableModel, newTable: TableModel): string[] {
  const statements: string[] = [];
  const tempName = `${newTable.name}_migration_temp`;

  // 1. Disable FK constraints temporarily to prevent orphan errors during migration
  statements.push(`PRAGMA foreign_keys = OFF;`);
  statements.push(`BEGIN TRANSACTION;`);

  // 2. Create the temp table with the new schema
  const tempTableSchema: TableModel = {
    ...newTable,
    name: tempName,
  };
  statements.push(generateCreateTableSQL(tempTableSchema));

  // 3. Transfer data from old table to temp table matching columns by name
  const oldColNames = oldTable.columns.map((c) => c.name);
  const matchedCols = newTable.columns
    .filter((c) => oldColNames.includes(c.name))
    .map((c) => c.name);

  if (matchedCols.length > 0) {
    const colsList = matchedCols.map((c) => `"${c}"`).join(", ");
    statements.push(
      `INSERT INTO "${tempName}" (${colsList}) SELECT ${colsList} FROM "${oldTable.name}";`
    );
  }

  // 4. Drop the old table
  statements.push(`DROP TABLE "${oldTable.name}";`);

  // 5. Rename the temp table to the final table name
  statements.push(`ALTER TABLE "${tempName}" RENAME TO "${newTable.name}";`);

  // 6. Commit transaction and restore FK constraints
  statements.push(`COMMIT;`);
  statements.push(`PRAGMA foreign_keys = ON;`);

  return statements;
}
