import { TableInfo } from "../db/adapters/adapter";

export interface MigrationVersion {
  id: string;
  name: string;
  timestamp: number;
  tablesSnapshot: TableInfo[];
}

export class MigrationTimeline {
  private getStorageKey(projectId: string): string {
    return `sqlstudio-migrations-${projectId}`;
  }

  getTimeline(projectId: string): MigrationVersion[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(projectId));
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Failed to load migration timeline", e);
    }
    return [];
  }

  saveTimeline(projectId: string, timeline: MigrationVersion[]) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.getStorageKey(projectId), JSON.stringify(timeline));
    } catch (e) {
      console.error("Failed to save migration timeline", e);
    }
  }

  addSchemaVersion(projectId: string, name: string, tables: TableInfo[]): MigrationVersion {
    const timeline = this.getTimeline(projectId);
    const newVersion: MigrationVersion = {
      id: `v-${Math.random().toString(36).substring(2)}`,
      name,
      timestamp: Date.now(),
      tablesSnapshot: JSON.parse(JSON.stringify(tables)), // Deep copy tables schema
    };

    timeline.push(newVersion);
    // Sort chronological descending
    timeline.sort((a, b) => b.timestamp - a.timestamp);
    this.saveTimeline(projectId, timeline);
    return newVersion;
  }

  deleteVersion(projectId: string, versionId: string) {
    const timeline = this.getTimeline(projectId);
    const filtered = timeline.filter((v) => v.id !== versionId);
    this.saveTimeline(projectId, filtered);
  }

  generateMigrationSQL(oldSchema: TableInfo[], newSchema: TableInfo[]): string {
    const statements: string[] = [];

    // 1. Identify added tables
    newSchema.forEach((newTable) => {
      const oldTable = oldSchema.find((t) => t.name === newTable.name);
      if (!oldTable) {
        // Generate CREATE TABLE statement
        const colDefs = newTable.columns.map((c) => {
          let def = `"${c.name}" ${c.type}`;
          if (c.pk) def += " PRIMARY KEY";
          if (c.notNull) def += " NOT NULL";
          if (c.unique) def += " UNIQUE";
          if (c.defaultVal) def += ` DEFAULT ${c.defaultVal}`;
          return def;
        });

        newTable.foreignKeys.forEach((fk) => {
          colDefs.push(`FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}")`);
        });

        statements.push(`CREATE TABLE "${newTable.name}" (\n  ${colDefs.join(",\n  ")}\n);`);
      } else {
        // Table exists, check added columns
        newTable.columns.forEach((newCol) => {
          const oldCol = oldTable.columns.find((c) => c.name === newCol.name);
          if (!oldCol) {
            let colSql = `ALTER TABLE "${newTable.name}" ADD COLUMN "${newCol.name}" ${newCol.type}`;
            if (newCol.notNull) colSql += " NOT NULL";
            if (newCol.defaultVal) colSql += ` DEFAULT ${newCol.defaultVal}`;
            statements.push(colSql + ";");
          }
        });
      }
    });

    // 2. Identify dropped tables
    oldSchema.forEach((oldTable) => {
      const newTable = newSchema.find((t) => t.name === oldTable.name);
      if (!newTable) {
        statements.push(`DROP TABLE "${oldTable.name}";`);
      }
    });

    return statements.length > 0 ? statements.join("\n") : "-- No schema changes detected.";
  }
}

export const migrationTimeline = new MigrationTimeline();
