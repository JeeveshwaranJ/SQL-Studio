import { QueryResponse, TableInfo } from "../db/adapters/adapter";

export interface DatabaseEngine {
  id: string; // 'sqlite' | 'postgres' | 'mysql'
  name: string;
  connect(dbName: string, binary?: Uint8Array): Promise<void>;
  execute(sql: string, options?: { signal?: AbortSignal }): Promise<QueryResponse>;
  getSchema(): Promise<TableInfo[]>;
  export(): Promise<Uint8Array>;
  close(): Promise<void>;
}
