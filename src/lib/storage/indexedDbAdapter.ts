const PERSIST_DB_NAME = "sqlstudio_projects_db";
const PROJECTS_STORE = "projects";
const DB_VERSION = 1;

export interface ProjectMetadata {
  id: string;
  name: string;
  dialect: "sqlite" | "postgres" | "mysql";
  updatedAt: number;
}

export interface ProjectData extends ProjectMetadata {
  binary?: Uint8Array;
}

function getIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is browser-only"));
      return;
    }
    const request = indexedDB.open(PERSIST_DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbAdapter {
  async saveProject(project: ProjectData): Promise<void> {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.put(project);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProject(id: string): Promise<ProjectData | null> {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readonly");
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readonly");
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const list = (request.result || []) as ProjectData[];
        // Filter out binary data for listing metadata efficiently
        const metadata = list.map(({ id, name, dialect, updatedAt }) => ({
          id,
          name,
          dialect,
          updatedAt,
        }));
        resolve(metadata.sort((a, b) => b.updatedAt - a.updatedAt));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, "readwrite");
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
