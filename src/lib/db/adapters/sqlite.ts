import { Database } from "sql.js";
import { DatabaseAdapter, QueryResponse, TableInfo } from "./adapter";

export class SqliteAdapter implements DatabaseAdapter {
  id = "sqlite";
  name: string;
  private db: Database;

  constructor(db: Database, name: string = "in-memory.db") {
    this.db = db;
    this.name = name;
  }

  async execute(sql: string): Promise<QueryResponse> {
    const startTime = performance.now();
    try {
      const query = sql.trim();
      if (!query) {
        return { columns: [], rows: [], executionTime: 0, error: null };
      }

      const res = this.db.exec(query);
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      let columns: string[] = [];
      let rows: any[][] = [];

      if (res.length > 0) {
        // Find the last statement returning results
        let lastResult = res[res.length - 1];
        for (let i = res.length - 1; i >= 0; i--) {
          if (res[i].columns && res[i].columns.length > 0) {
            lastResult = res[i];
            break;
          }
        }
        columns = lastResult.columns;
        rows = lastResult.values;
      }

      return {
        columns,
        rows,
        executionTime,
        error: null,
      };
    } catch (err: any) {
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);
      return {
        columns: [],
        rows: [],
        executionTime,
        error: err?.message || String(err),
      };
    }
  }

  async getSchema(): Promise<TableInfo[]> {
    try {
      const tablesResult = this.db.exec(
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
      );
      if (tablesResult.length === 0 || !tablesResult[0].values) return [];

      const tableRows = tablesResult[0].values;
      const schema: TableInfo[] = [];

      for (const row of tableRows) {
        const tableName = row[0] as string;
        const tableSql = (row[1] as string) || "";

        // Query column details via table_info
        const columns: any[] = [];
        const infoResult = this.db.exec(`PRAGMA table_info("${tableName.replace(/"/g, '""')}");`);

        if (infoResult.length > 0 && infoResult[0].values) {
          infoResult[0].values.forEach((colRow) => {
            columns.push({
              name: colRow[1] as string,
              type: (colRow[2] as string) || "TEXT",
              pk: colRow[5] !== null && Number(colRow[5]) > 0,
              unique: false, // Resolved in next step
              defaultVal: colRow[4] !== null ? String(colRow[4]) : null,
              notNull: Boolean(colRow[3]),
            });
          });
        }

        // Query UNIQUE columns using index pragmas
        const indexResult = this.db.exec(`PRAGMA index_list("${tableName.replace(/"/g, '""')}");`);
        if (indexResult.length > 0 && indexResult[0].values) {
          indexResult[0].values.forEach((indexRow) => {
            const isUnique = indexRow[2] !== null && Number(indexRow[2]) === 1;
            const indexName = indexRow[1] as string;

            if (isUnique) {
              const indexInfo = this.db.exec(`PRAGMA index_info("${indexName.replace(/"/g, '""')}");`);
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

        // Query relationships
        const foreignKeys: any[] = [];
        const fkResult = this.db.exec(`PRAGMA foreign_key_list("${tableName.replace(/"/g, '""')}");`);
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

        // Parse CHECK constraints from table SQL
        const checkConstraints: string[] = [];
        const sqlUpper = tableSql.toUpperCase();
        let pos = 0;

        while (true) {
          const checkIdx = sqlUpper.indexOf("CHECK", pos);
          if (checkIdx === -1) break;

          const openParenIdx = tableSql.indexOf("(", checkIdx);
          if (openParenIdx === -1) {
            pos = checkIdx + 5;
            continue;
          }

          let count = 1;
          let scanPos = openParenIdx + 1;
          while (scanPos < tableSql.length && count > 0) {
            const char = tableSql[scanPos];
            if (char === "(") count++;
            else if (char === ")") count--;
            scanPos++;
          }

          if (count === 0) {
            const checkContent = tableSql.substring(openParenIdx + 1, scanPos - 1).trim();
            if (!checkConstraints.includes(checkContent)) {
              checkConstraints.push(checkContent);
            }
          }
          pos = scanPos;
        }

        schema.push({
          name: tableName,
          columns,
          foreignKeys,
          checkConstraints,
        });
      }

      return schema;
    } catch (err) {
      console.error("[SQLiteAdapter] Error building schema:", err);
      return [];
    }
  }

  export(): Uint8Array {
    return this.db.export();
  }

  async close(): Promise<void> {
    try {
      this.db.close();
    } catch (e) {
      console.error("[SQLiteAdapter] Error closing db:", e);
    }
  }
}
