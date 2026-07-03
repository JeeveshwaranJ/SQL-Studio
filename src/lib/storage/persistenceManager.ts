import { IndexedDbAdapter, ProjectMetadata, ProjectData } from "./indexedDbAdapter";
import { OpfsAdapter } from "./opfsAdapter";

export class PersistenceManager {
  private idb = new IndexedDbAdapter();
  private opfs = new OpfsAdapter();

  async listProjects(): Promise<ProjectMetadata[]> {
    return this.idb.listProjects();
  }

  async saveProject(id: string, name: string, dialect: "sqlite" | "postgres" | "mysql", binary?: Uint8Array): Promise<void> {
    const updatedAt = Date.now();
    const metadata: ProjectMetadata = { id, name, dialect, updatedAt };

    if (binary) {
      if (this.opfs.isSupported()) {
        // Save binary to OPFS and metadata to IndexedDB (without binary payload)
        await this.opfs.saveFile(`${id}.db`, binary);
        await this.idb.saveProject(metadata);
      } else {
        // Fallback: save both to IndexedDB
        await this.idb.saveProject({ ...metadata, binary });
      }
    } else {
      // Just metadata update
      await this.idb.saveProject(metadata);
    }
  }

  async getProject(id: string): Promise<ProjectData | null> {
    const project = await this.idb.getProject(id);
    if (!project) return null;

    if (this.opfs.isSupported()) {
      const binary = await this.opfs.readFile(`${id}.db`);
      if (binary) {
        project.binary = binary;
      }
    }
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await this.idb.deleteProject(id);
    if (this.opfs.isSupported()) {
      await this.opfs.deleteFile(`${id}.db`);
    }
  }
}

export const persistenceManager = new PersistenceManager();
