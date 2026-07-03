import { createNewDatabase } from "../db/sqlite";
import { SchemaModel, TableModel, ColumnModel, ForeignKeyModel } from "../schema/parser";

/**
 * Shared parser that ingests a raw SQL script and compiles it into a standard SchemaModel.
 */
export async function parseSqlDdlText(ddlText: string): Promise<SchemaModel> {
  const db = await createNewDatabase();
  
  let sql = ddlText;
  
  // 1. Strip sql comments
  sql = sql.replace(/--.*$/gm, "");
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, "");

  // 2. Preprocess dialect specific definitions to avoid parser blocks in sql.js
  sql = sql.replace(/SERIAL\s+PRIMARY\s+KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
  sql = sql.replace(/BIGSERIAL\s+PRIMARY\s+KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
  sql = sql.replace(/SERIAL/gi, "INTEGER");
  sql = sql.replace(/BIGSERIAL/gi, "INTEGER");
  sql = sql.replace(/AUTO_INCREMENT/gi, "");
  sql = sql.replace(/ENGINE\s*=\s*\w+/gi, "");
  sql = sql.replace(/CHARACTER\s+SET\s+\w+/gi, "");
  sql = sql.replace(/COLLATE\s+\w+/gi, "");
  sql = sql.replace(/DEFAULT\s+now\(\)/gi, "DEFAULT CURRENT_TIMESTAMP");
  
  // Remove schema qualifications so they resolve locally: public.users -> users
  sql = sql.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\.(\w+)/gi, "CREATE TABLE $2");
  sql = sql.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'](\w+)["']\.["'](\w+)["']/gi, 'CREATE TABLE "$2"');
  
  // Execute queries statements sequentially
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      db.run(stmt + ";");
    } catch (e) {
      console.warn("DDL parser pre-seed statement warning: ", e);
    }
  }

  // 3. Extract schema details from master records
  try {
    const tablesResult = db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    
    if (tablesResult.length === 0 || !tablesResult[0].values) {
      db.close();
      return { tables: [] };
    }

    const tableRows = tablesResult[0].values;
    const tables: TableModel[] = [];

    for (const row of tableRows) {
      const tableName = row[0] as string;
      const tableSql = (row[1] as string) || "";

      // Column info
      const columns: ColumnModel[] = [];
      const infoResult = db.exec(`PRAGMA table_info("${tableName.replace(/"/g, '""')}");`);
      
      if (infoResult.length > 0 && infoResult[0].values) {
        infoResult[0].values.forEach((colRow) => {
          columns.push({
            name: colRow[1] as string,
            type: (colRow[2] as string) || "TEXT",
            pk: colRow[5] !== null && Number(colRow[5]) > 0,
            unique: false,
            defaultVal: colRow[4] !== null ? String(colRow[4]) : null,
            notNull: Boolean(colRow[3]),
          });
        });
      }

      // Unique index flags
      const indexResult = db.exec(`PRAGMA index_list("${tableName.replace(/"/g, '""')}");`);
      if (indexResult.length > 0 && indexResult[0].values) {
        indexResult[0].values.forEach((indexRow) => {
          const isUnique = indexRow[2] !== null && Number(indexRow[2]) === 1;
          const indexName = indexRow[1] as string;
          if (isUnique) {
            const indexInfo = db.exec(`PRAGMA index_info("${indexName.replace(/"/g, '""')}");`);
            if (indexInfo.length > 0 && indexInfo[0].values) {
              indexInfo[0].values.forEach((colRow) => {
                const colName = colRow[2] as string;
                const col = columns.find((c) => c.name === colName);
                if (col) col.unique = true;
              });
            }
          }
        });
      }

      // Foreign keys
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

      // CHECK constraint regex parser
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

      tables.push({
        name: tableName,
        columns,
        foreignKeys,
        checkConstraints,
      });
    }

    db.close();
    return { tables };
  } catch (err) {
    db.close();
    console.error("DDL text compilation error", err);
    return { tables: [] };
  }
}
