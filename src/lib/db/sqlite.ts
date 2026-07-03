import initSqlJs, { Database } from "sql.js";

let SQLInstance: any = null;

/**
 * Loads and caches the sql.js WASM engine.
 */
export async function getSqlJsEngine() {
  if (!SQLInstance) {
    SQLInstance = await initSqlJs({
      locateFile: (file) => {
        const target = file === "sql-wasm-browser.wasm" ? "sql-wasm.wasm" : file;
        return `https://unpkg.com/sql.js@1.14.1/dist/${target}`;
      },
    });
  }
  return SQLInstance;
}

/**
 * Creates a new blank SQLite database.
 */
export async function createNewDatabase(): Promise<Database> {
  const SQL = await getSqlJsEngine();
  return new SQL.Database();
}

/**
 * Loads a database from an existing binary array (e.g., from a file upload).
 */
export async function loadDatabaseFromBinary(data: Uint8Array): Promise<Database> {
  const SQL = await getSqlJsEngine();
  return new SQL.Database(data);
}

/**
 * Seeds a database with sample tables and rows.
 */
export function seedSampleData(db: Database): void {
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

  // Check if seed data exists before inserting
  const userCount = db.exec("SELECT COUNT(*) FROM users")[0].values[0][0];
  if (Number(userCount) === 0) {
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
}
