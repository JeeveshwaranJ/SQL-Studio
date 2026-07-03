import { Database } from "sql.js";

export interface ColumnModel {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  defaultVal: string | null;
  notNull: boolean;
}

export interface ForeignKeyModel {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableModel {
  name: string;
  columns: ColumnModel[];
  foreignKeys: ForeignKeyModel[];
  checkConstraints: string[];
}

export interface SchemaModel {
  tables: TableModel[];
}

/**
 * Parses balanced parentheses from SQL starting from an index to extract constraints.
 */
function parseCheckConstraintsFromSql(sql: string): string[] {
  if (!sql) return [];
  const checks: string[] = [];
  const sqlUpper = sql.toUpperCase();
  let pos = 0;

  while (true) {
    const checkIdx = sqlUpper.indexOf("CHECK", pos);
    if (checkIdx === -1) break;

    // Locate the first opening parenthesis after the "CHECK" keyword
    const openParenIdx = sql.indexOf("(", checkIdx);
    if (openParenIdx === -1) {
      pos = checkIdx + 5;
      continue;
    }

    // Traverse and track nested parenthesis depth to find the closing one
    let count = 1;
    let scanPos = openParenIdx + 1;
    while (scanPos < sql.length && count > 0) {
      const char = sql[scanPos];
      if (char === "(") count++;
      else if (char === ")") count--;
      scanPos++;
    }

    if (count === 0) {
      const checkContent = sql.substring(openParenIdx + 1, scanPos - 1).trim();
      // Ensure we don't add duplicates
      if (!checks.includes(checkContent)) {
        checks.push(checkContent);
      }
    }

    pos = scanPos;
  }
  return checks;
}

/**
 * Extracts a normalized schema model from the active sql.js Database instance.
 */
export function parseDbSchema(db: Database): SchemaModel {
  try {
    // 1. Get all user-defined tables
    const tablesResult = db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    if (tablesResult.length === 0 || !tablesResult[0].values) {
      return { tables: [] };
    }

    const tableRows = tablesResult[0].values;
    const tables: TableModel[] = [];

    for (const row of tableRows) {
      const tableName = row[0] as string;
      const tableSql = row[1] as string || "";

      // 2. Query columns info via table_info
      const columns: ColumnModel[] = [];
      const infoResult = db.exec(`PRAGMA table_info("${tableName.replace(/"/g, '""')}");`);
      
      if (infoResult.length > 0 && infoResult[0].values) {
        infoResult[0].values.forEach((colRow) => {
          columns.push({
            name: colRow[1] as string,
            type: (colRow[2] as string) || "TEXT",
            pk: colRow[5] !== null && Number(colRow[5]) > 0, // pk column has index > 0 if primary key
            unique: false, // will resolve via index_list below
            defaultVal: colRow[4] !== null ? String(colRow[4]) : null,
            notNull: Boolean(colRow[3]),
          });
        });
      }

      // 3. Resolve UNIQUE constraints using index_list & index_info
      const indexResult = db.exec(`PRAGMA index_list("${tableName.replace(/"/g, '""')}");`);
      if (indexResult.length > 0 && indexResult[0].values) {
        indexResult[0].values.forEach((indexRow) => {
          const isUnique = indexRow[2] !== null && Number(indexRow[2]) === 1;
          const indexName = indexRow[1] as string;

          // Check if index is UNIQUE and not an automatic primary key index
          if (isUnique) {
            const indexInfo = db.exec(`PRAGMA index_info("${indexName.replace(/"/g, '""')}");`);
            if (indexInfo.length > 0 && indexInfo[0].values) {
              indexInfo[0].values.forEach((colRow) => {
                const colName = colRow[2] as string;
                const col = columns.find((c) => c.name === colName);
                if (col) {
                  col.unique = true;
                }
              });
            }
          }
        });
      }

      // 4. Query relationships via foreign_key_list
      const foreignKeys: ForeignKeyModel[] = [];
      const fkResult = db.exec(`PRAGMA foreign_key_list("${tableName.replace(/"/g, '""')}");`);
      if (fkResult.length > 0 && fkResult[0].values) {
        fkResult[0].values.forEach((fkRow) => {
          const fromCol = fkRow[3] as string;
          const refTable = fkRow[2] as string;
          const toCol = fkRow[4] as string;

          if (fromCol && refTable && toCol) {
            foreignKeys.push({
              column: fromCol,
              refTable,
              refColumn: toCol,
            });
          }
        });
      }

      // 5. Parse CHECK constraints from table SQL
      const checkConstraints = parseCheckConstraintsFromSql(tableSql);

      tables.push({
        name: tableName,
        columns,
        foreignKeys,
        checkConstraints,
      });
    }

    return { tables };
  } catch (err) {
    console.error("Failed to parse database schema", err);
    return { tables: [] };
  }
}
