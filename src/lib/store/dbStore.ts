import { create } from "zustand";
import { DatabaseAdapter, QueryResponse as QueryResult, TableInfo as TableSchema, ColumnInfo } from "../db/adapters/adapter";
import { SqliteWorkerAdapter } from "../database/sqliteWorkerAdapter";
import { RemoteAdapter } from "../db/adapters/remote";
import { useHistoryStore } from "./historyStore";
import { useDesignerStore } from "./designerStore";
import { ValidationProblem } from "../sql/dialects/dialect";
import { saveDatabase, loadDatabase } from "../db/persistence";

export type { TableSchema, ColumnInfo, QueryResult };

interface DbState {
  adapter: DatabaseAdapter | null;
  dbName: string;
  projectId: string;
  isDbLoading: boolean;
  tables: TableSchema[];
  results: (QueryResult & { sql?: string }) | null;
  activeQuery: string;
  activeAbortController: AbortController | null;
  validationProblems: ValidationProblem[];

  // Actions
  initDb: () => Promise<void>;
  loadDbFromFile: (file: File) => Promise<void>;
  runQuery: (sqlText: string) => Promise<void>;
  cancelQuery: () => void;
  connectRemoteDb: (
    driver: "postgres" | "mysql",
    sessionId: string,
    host: string,
    port: string,
    database: string
  ) => Promise<void>;
  disconnect: () => Promise<void>;
  exportDb: () => void;
  setActiveQuery: (query: string) => void;
  refreshSchema: () => void;
  setValidationProblems: (problems: ValidationProblem[]) => void;
  
  // Project Management Actions
  createProjectFromTemplate: (name: string, templateSql: string) => Promise<void>;
  loadSavedProject: (id: string) => Promise<void>;
  deleteSavedProject: (id: string) => Promise<void>;
}

export const useDbStore = create<DbState>((set, get) => ({
  adapter: null,
  dbName: "in-memory.db",
  projectId: "default",
  isDbLoading: false,
  tables: [],
  results: null,
  activeQuery: "SELECT * FROM users;",
  activeAbortController: null,
  validationProblems: [],

  initDb: async () => {
    set({ isDbLoading: true });
    try {
      const savedBinary = await loadDatabase("active-sqlite-db");
      const loadedDbName = savedBinary ? "autosaved.db" : "in-memory.db";
      const projId = "default";

      const adapter = new SqliteWorkerAdapter(loadedDbName);
      await adapter.connect(loadedDbName, savedBinary || undefined);
      const tables = await adapter.getSchema();
      
      // Close previous adapter if any
      const oldAdapter = get().adapter;
      if (oldAdapter) {
        await oldAdapter.close();
      }

      set({
        adapter,
        dbName: loadedDbName,
        projectId: projId,
        tables,
        isDbLoading: false,
        results: null,
      });

      // Sync visual designer
      useDesignerStore.getState().syncSchema(adapter as any, loadedDbName);
      useHistoryStore.getState().syncCurrentDbHistory(loadedDbName);
    } catch (err) {
      console.error("Local SQLite initialization failed", err);
      set({ isDbLoading: false });
    }
  },

  loadDbFromFile: async (file: File) => {
    set({ isDbLoading: true });
    try {
      const reader = new FileReader();
      const loadPromise = new Promise<Uint8Array>((resolve, reject) => {
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(reader.result));
          } else {
            reject(new Error("Failed to read file as ArrayBuffer"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });

      const binaryData = await loadPromise;
      const projId = typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2);
      
      const adapter = new SqliteWorkerAdapter(file.name);
      await adapter.connect(file.name, binaryData);
      const tables = await adapter.getSchema();

      const oldAdapter = get().adapter;
      if (oldAdapter) {
        await oldAdapter.close();
      }

      set({
        adapter,
        dbName: file.name,
        projectId: projId,
        tables,
        isDbLoading: false,
        results: null,
      });

      // Sync visual designer
      useDesignerStore.getState().syncSchema(adapter as any, file.name);
      useHistoryStore.getState().syncCurrentDbHistory(file.name);

      // Save to persistence manager
      const { persistenceManager } = await import("../storage/persistenceManager");
      await persistenceManager.saveProject(projId, file.name.split(".")[0], "sqlite", binaryData);
      await saveDatabase("active-sqlite-db", binaryData);
    } catch (err) {
      console.error("Failed to load SQLite file", err);
      set({ isDbLoading: false });
    }
  },

  runQuery: async (sqlText: string) => {
    const { adapter, activeAbortController } = get();
    if (!adapter) {
      set({
        results: {
          columns: [],
          rows: [],
          executionTime: 0,
          error: "Database not connected.",
          sql: sqlText,
        },
      });
      return;
    }

    // Cancel any currently running query first
    if (activeAbortController) {
      activeAbortController.abort();
    }

    const controller = new AbortController();
    set({ activeAbortController: controller });

    try {
      const res = await adapter.execute(sqlText, { signal: controller.signal });
      
      // Check if we were aborted in the meantime
      if (controller.signal.aborted) return;

      set({
        results: {
          ...res,
          sql: sqlText,
        },
        activeAbortController: null,
      });

      // Add to history
      const success = res.error === null;
      useHistoryStore.getState().addHistoryItem(sqlText, success, res.executionTime, res.error);

      // Refresh schema on schema-altering statements
      const isSchemaAltering = /create|alter|drop|insert|update|delete|replace/i.test(sqlText);
      if (isSchemaAltering && success) {
        get().refreshSchema();
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;

      const errorMessage = err?.message || String(err);
      set({
        results: {
          columns: [],
          rows: [],
          executionTime: 0,
          error: errorMessage,
          sql: sqlText,
        },
        activeAbortController: null,
      });

      useHistoryStore.getState().addHistoryItem(sqlText, false, 0, errorMessage);
    }
  },

  cancelQuery: () => {
    const { activeAbortController } = get();
    if (activeAbortController) {
      activeAbortController.abort();
      set({ activeAbortController: null });
    }
  },

  connectRemoteDb: async (driver, sessionId, host, port, database) => {
    set({ isDbLoading: true });
    try {
      const displayName = `${host}:${port}/${database}`;
      const adapter = new RemoteAdapter(driver, sessionId, displayName);
      const tables = await adapter.getSchema();
      const projId = typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2);

      const oldAdapter = get().adapter;
      if (oldAdapter) {
        await oldAdapter.close();
      }

      set({
        adapter,
        dbName: displayName,
        projectId: projId,
        tables,
        isDbLoading: false,
        results: null,
        activeQuery: driver === "postgres" 
          ? "SELECT * FROM information_schema.tables WHERE table_schema = 'public';" 
          : "SHOW TABLES;",
      });

      // Sync visual designer (cast adapter to fit existing schema compiler signatures)
      useDesignerStore.getState().syncSchema(adapter as any, displayName);
      useHistoryStore.getState().syncCurrentDbHistory(displayName);

      // Save connection metadata to persistence
      const { persistenceManager } = await import("../storage/persistenceManager");
      await persistenceManager.saveProject(projId, displayName, driver);
    } catch (err) {
      console.error("Remote DB connection initialization failed", err);
      set({ isDbLoading: false });
    }
  },

  disconnect: async () => {
    const { adapter } = get();
    if (adapter) {
      set({ isDbLoading: true });
      await adapter.close();
      // Re-initialize local seeded SQLite db as fallback
      await get().initDb();
    }
  },

  exportDb: () => {
    const { adapter, dbName } = get();
    if (!adapter || adapter.id !== "sqlite") {
      alert("Database export is only supported for local SQLite files.");
      return;
    }

    try {
      const binaryData = (adapter as any).export();
      const blob = new Blob([binaryData as any], { type: "application/x-sqlite3" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const downloadName = dbName.endsWith(".sqlite") || dbName.endsWith(".db") 
        ? dbName 
        : `${dbName.split(".")[0]}.sqlite`;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export database", err);
    }
  },

  setActiveQuery: (query) => {
    set({ activeQuery: query });
  },

  setValidationProblems: (problems) => {
    set({ validationProblems: problems });
  },

  refreshSchema: async () => {
    const { adapter, dbName, projectId } = get();
    if (adapter) {
      const tables = await adapter.getSchema();
      set({ tables });
      
      // Update visual designer
      useDesignerStore.getState().syncSchema(adapter as any, dbName);

      // Autosave SQLite binary to persistence and active DB save
      if (adapter.id === "sqlite") {
        try {
          const binaryData = (adapter as any).export();
          await saveDatabase("active-sqlite-db", binaryData);
          
          const { persistenceManager } = await import("../storage/persistenceManager");
          const projName = dbName.replace(/\.(db|sqlite3?)$/, "");
          await persistenceManager.saveProject(projectId, projName, "sqlite", binaryData);
        } catch (err) {
          console.error("Failed to autosave DB:", err);
        }
      }
    }
  },

  createProjectFromTemplate: async (name, templateSql) => {
    set({ isDbLoading: true });
    try {
      const projId = typeof crypto !== "undefined" && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2);
      const loadedDbName = `${name.toLowerCase().replace(/\s+/g, "_")}.db`;

      const adapter = new SqliteWorkerAdapter(loadedDbName);
      await adapter.connect(loadedDbName); // Starts new blank db inside worker

      // Seed the template SQL statements
      if (templateSql) {
        // Execute the entire SQL schema setup inside the worker
        await adapter.execute(templateSql);
      }

      const tables = await adapter.getSchema();
      
      const oldAdapter = get().adapter;
      if (oldAdapter) {
        await oldAdapter.close();
      }

      set({
        adapter,
        dbName: loadedDbName,
        projectId: projId,
        tables,
        isDbLoading: false,
        results: null,
      });

      // Sync visual designer
      useDesignerStore.getState().syncSchema(adapter as any, loadedDbName);
      useHistoryStore.getState().syncCurrentDbHistory(loadedDbName);

      // Save to persistence
      const binaryData = await adapter.export();
      const { persistenceManager } = await import("../storage/persistenceManager");
      await persistenceManager.saveProject(projId, name, "sqlite", binaryData);
      await saveDatabase("active-sqlite-db", binaryData);
    } catch (err) {
      console.error("Failed to create template project", err);
      set({ isDbLoading: false });
    }
  },

  loadSavedProject: async (id) => {
    set({ isDbLoading: true });
    try {
      const { persistenceManager } = await import("../storage/persistenceManager");
      const project = await persistenceManager.getProject(id);
      if (!project) throw new Error("Project not found");

      const loadedDbName = `${project.name}.db`;
      const adapter = new SqliteWorkerAdapter(loadedDbName);
      await adapter.connect(loadedDbName, project.binary);
      const tables = await adapter.getSchema();

      const oldAdapter = get().adapter;
      if (oldAdapter) {
        await oldAdapter.close();
      }

      set({
        adapter,
        dbName: loadedDbName,
        projectId: id,
        tables,
        isDbLoading: false,
        results: null,
      });

      // Sync visual designer
      useDesignerStore.getState().syncSchema(adapter as any, loadedDbName);
      useHistoryStore.getState().syncCurrentDbHistory(loadedDbName);

      // Cache as active db in local saves
      if (project.binary) {
        await saveDatabase("active-sqlite-db", project.binary);
      }
    } catch (err) {
      console.error("Failed to load saved project", err);
      set({ isDbLoading: false });
    }
  },

  deleteSavedProject: async (id) => {
    try {
      const { persistenceManager } = await import("../storage/persistenceManager");
      await persistenceManager.deleteProject(id);
      
      // If we deleted the active project, reset to default
      if (get().projectId === id) {
        await get().initDb();
      }
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  },
}));
