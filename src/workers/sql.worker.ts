// Web Worker to run SQLite WASM execution in the background

declare const importScripts: (...urls: string[]) => void;

let SQL: any = null;
let db: any = null;

// Initialize sql.js in the worker
async function initEngine() {
  if (SQL) return;
  
  importScripts("https://unpkg.com/sql.js@1.14.1/dist/sql-wasm.js");
  
  // @ts-ignore
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      const target = file === "sql-wasm-browser.wasm" ? "sql-wasm.wasm" : file;
      return `https://unpkg.com/sql.js@1.14.1/dist/${target}`;
    },
  });
}

// Helper to compile/extract schema structure in worker
function buildSchema() {
  if (!db) return [];
  try {
    const tablesResult = db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    if (tablesResult.length === 0 || !tablesResult[0].values) return [];

    const tableRows = tablesResult[0].values;
    const schema = [];

    for (const row of tableRows) {
      const tableName = row[0] as string;
      const tableSql = (row[1] as string) || "";

      // Query column details via table_info
      const columns: any[] = [];
      const infoResult = db.exec(`PRAGMA table_info("${tableName.replace(/"/g, '""')}");`);

      if (infoResult.length > 0 && infoResult[0].values) {
        infoResult[0].values.forEach((colRow: any) => {
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

      // Query UNIQUE columns using index pragmas
      const indexResult = db.exec(`PRAGMA index_list("${tableName.replace(/"/g, '""')}");`);
      if (indexResult.length > 0 && indexResult[0].values) {
        indexResult[0].values.forEach((indexRow: any) => {
          const isUnique = indexRow[2] !== null && Number(indexRow[2]) === 1;
          const indexName = indexRow[1] as string;

          if (isUnique) {
            const indexInfo = db.exec(`PRAGMA index_info("${indexName.replace(/"/g, '""')}");`);
            if (indexInfo.length > 0 && indexInfo[0].values) {
              indexInfo[0].values.forEach((colRow: any) => {
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
      const fkResult = db.exec(`PRAGMA foreign_key_list("${tableName.replace(/"/g, '""')}");`);
      if (fkResult.length > 0 && fkResult[0].values) {
        fkResult[0].values.forEach((fkRow: any) => {
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
    console.error("[Worker] Error building schema:", err);
    return [];
  }
}

// Listen to message events from UI thread
self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    await initEngine();

    if (type === "connect") {
      if (db) {
        try { db.close(); } catch {}
      }
      
      if (payload && payload.binary) {
        db = new SQL.Database(payload.binary);
      } else {
        db = new SQL.Database();
        // Seed default template data if new
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
        `);

        db.run(`
          INSERT INTO users (name, email, role) VALUES 
            ('Alice Smith', 'alice@example.com', 'Admin'),
            ('Bob Jones', 'bob@example.com', 'User'),
            ('Charlie Brown', 'charlie@example.com', 'User'),
            ('Diana Prince', 'diana@example.com', 'Manager');

          INSERT INTO orders (user_id, product, amount, status) VALUES 
            (1, 'MacBook Pro 16"', 2499.99, 'Delivered'),
            (1, 'Magic Mouse 2', 79.00, 'Shipped'),
            (2, 'iPhone 15 Pro', 999.99, 'Delivered'),
            (3, 'AirPods Pro 2', 249.00, 'Processing'),
            (4, 'iPad Air', 599.00, 'Delivered');
        `);
      }

      self.postMessage({ id, success: true });
    } else if (type === "execute") {
      if (!db) throw new Error("Database not connected");

      const startTime = performance.now();
      const sql = payload.sql.trim();

      if (!sql) {
        self.postMessage({
          id,
          success: true,
          result: { columns: [], rows: [], executionTime: 0, error: null }
        });
        return;
      }

      const res = db.exec(sql);
      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      let columns: string[] = [];
      let rows: any[][] = [];

      if (res.length > 0) {
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

      self.postMessage({
        id,
        success: true,
        result: {
          columns,
          rows,
          executionTime,
          error: null
        }
      });
    } else if (type === "getSchema") {
      const schema = buildSchema();
      self.postMessage({ id, success: true, result: schema });
    } else if (type === "export") {
      if (!db) throw new Error("Database not connected");
      const binary = db.export();
      (self as any).postMessage({ id, success: true, result: binary }, [binary.buffer]);
    } else if (type === "close") {
      if (db) {
        db.close();
        db = null;
      }
      self.postMessage({ id, success: true });
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message || String(err) });
  }
};
export {};
