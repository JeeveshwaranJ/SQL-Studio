export interface QueryResponse {
  columns: string[];
  rows: any[][];
  executionTime: number;
  error: string | null;
}

export interface ColumnInfo {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  notNull: boolean;
  defaultVal: string | null;
}

export interface ForeignKeyInfo {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  checkConstraints: string[];
}

export interface DatabaseAdapter {
  id: string; // 'sqlite' | 'postgres' | 'mysql'
  name: string; // Display name (e.g. 'in-memory.db' or 'localhost:5432')
  execute: (sql: string, options?: { signal?: AbortSignal }) => Promise<QueryResponse>;
  getSchema: () => Promise<TableInfo[]>;
  close: () => Promise<void>;
}
