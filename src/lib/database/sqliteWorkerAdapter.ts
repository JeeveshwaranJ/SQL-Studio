import { DatabaseEngine } from "./types";
import { DatabaseAdapter, QueryResponse, TableInfo } from "../db/adapters/adapter";

export class SqliteWorkerAdapter implements DatabaseEngine, DatabaseAdapter {
  id = "sqlite";
  name: string;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(name: string = "in-memory.db") {
    this.name = name;
  }

  async connect(dbName: string, binary?: Uint8Array): Promise<void> {
    this.name = dbName;
    if (!this.worker) {
      // Instantiate Next.js Worker
      this.worker = new Worker(new URL("../../workers/sql.worker.ts", import.meta.url), {
        type: "module",
      });
      
      this.worker.onmessage = (e) => {
        const { id, success, result, error } = e.data;
        const request = this.pendingRequests.get(id);
        if (request) {
          this.pendingRequests.delete(id);
          if (success) {
            request.resolve(result);
          } else {
            request.reject(new Error(error || "Worker task failed"));
          }
        }
      };
      
      this.worker.onerror = (err) => {
        console.error("[SqliteWorkerAdapter] Worker thread error:", err);
      };
    }

    return this.postToWorker("connect", { binary });
  }

  private postToWorker(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker not initialized"));
        return;
      }
      const requestId = typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2);
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker.postMessage({ id: requestId, type, payload });
    });
  }

  async execute(sql: string, options?: { signal?: AbortSignal }): Promise<QueryResponse> {
    if (options?.signal?.aborted) {
      return { columns: [], rows: [], executionTime: 0, error: "Query aborted" };
    }
    return this.postToWorker("execute", { sql });
  }

  async getSchema(): Promise<TableInfo[]> {
    return this.postToWorker("getSchema");
  }

  async export(): Promise<Uint8Array> {
    return this.postToWorker("export");
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.postToWorker("close");
      this.worker.terminate();
      this.worker = null;
    }
  }
}
