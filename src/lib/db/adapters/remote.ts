import { DatabaseAdapter, QueryResponse, TableInfo } from "./adapter";

export class RemoteAdapter implements DatabaseAdapter {
  id: "postgres" | "mysql";
  name: string;
  private sessionId: string;

  constructor(driver: "postgres" | "mysql", sessionId: string, name: string) {
    this.id = driver;
    this.sessionId = sessionId;
    this.name = name;
  }

  async execute(sql: string, options?: { signal?: AbortSignal }): Promise<QueryResponse> {
    try {
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          sql,
        }),
        signal: options?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          columns: [],
          rows: [],
          executionTime: 0,
          error: errorData.error || `HTTP error! status: ${response.status}`,
        };
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === "AbortError") {
        return {
          columns: [],
          rows: [],
          executionTime: 0,
          error: "Query cancelled by client.",
        };
      }
      return {
        columns: [],
        rows: [],
        executionTime: 0,
        error: err.message || String(err),
      };
    }
  }

  async getSchema(): Promise<TableInfo[]> {
    try {
      const response = await fetch(`/api/db/schema?sessionId=${encodeURIComponent(this.sessionId)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.tables || [];
    } catch (err) {
      console.error("[RemoteAdapter] Failed to fetch schema:", err);
      return [];
    }
  }

  async close(): Promise<void> {
    try {
      await fetch("/api/db/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
        }),
      });
    } catch (e) {
      console.error("[RemoteAdapter] Error disconnecting:", e);
    }
  }
}
