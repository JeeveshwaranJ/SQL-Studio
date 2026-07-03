import { faker } from "@faker-js/faker";
import { TableInfo, DatabaseAdapter, ColumnInfo } from "../db/adapters/adapter";

export interface ColumnGenConfig {
  genType: "name" | "address" | "email" | "phone" | "uuid" | "date" | "number" | "regex" | "fk";
  min?: number; // For number ranges
  max?: number; // For number ranges
  regex?: string; // For custom regex rules
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string; // YYYY-MM-DD
}

/**
 * Topologically sorts tables based on foreign key relationships.
 * Parents (referenced tables) will be placed before Children (tables with FKs).
 */
export function sortTablesTopologically(tables: TableInfo[]): TableInfo[] {
  const sorted: TableInfo[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const tableMap = new Map<string, TableInfo>();

  tables.forEach((t) => tableMap.set(t.name, t));

  function visit(table: TableInfo) {
    if (visited.has(table.name)) return;
    if (visiting.has(table.name)) {
      // Circular reference detected, break loop by skipping back-edge
      return;
    }
    visiting.add(table.name);

    // Visit all tables referenced by this table's foreign keys first
    table.foreignKeys.forEach((fk) => {
      const parentTable = tableMap.get(fk.refTable);
      if (parentTable) {
        visit(parentTable);
      }
    });

    visiting.delete(table.name);
    visited.add(table.name);
    sorted.push(table);
  }

  tables.forEach((t) => visit(t));
  return sorted;
}

/**
 * Generates a mock value for a given column based on its generator configuration.
 */
export function generateCellMockValue(
  col: ColumnInfo,
  config: ColumnGenConfig,
  parentPkPool: any[]
): any {
  if (config.genType === "fk") {
    if (parentPkPool && parentPkPool.length > 0) {
      const idx = Math.floor(Math.random() * parentPkPool.length);
      return parentPkPool[idx];
    }
    // Fallback if parent pool is empty
    return col.type.toUpperCase().includes("INT") ? 1 : "1";
  }

  switch (config.genType) {
    case "name":
      return faker.person.fullName();
    case "address":
      return faker.location.streetAddress();
    case "email":
      return faker.internet.email();
    case "phone":
      return faker.phone.number();
    case "uuid":
      return faker.string.uuid();
    case "date": {
      const start = config.dateStart ? new Date(config.dateStart) : new Date(2020, 0, 1);
      const end = config.dateEnd ? new Date(config.dateEnd) : new Date();
      return faker.date.between({ from: start, to: end }).toISOString().slice(0, 19).replace("T", " ");
    }
    case "number": {
      const min = config.min !== undefined ? config.min : 1;
      const max = config.max !== undefined ? config.max : 1000;
      return faker.number.int({ min, max });
    }
    case "regex": {
      if (config.regex) {
        try {
          return faker.helpers.fromRegExp(new RegExp(config.regex));
        } catch (e) {
          return `invalid_regex_${config.regex}`;
        }
      }
      return faker.string.alphanumeric(8);
    }
    default:
      // Fallback based on column SQL type
      const type = col.type.toUpperCase();
      if (type.includes("INT") || type.includes("SERIAL")) {
        return faker.number.int({ min: 1, max: 100 });
      }
      if (type.includes("DOUBLE") || type === "REAL" || type === "FLOAT") {
        return faker.number.float({ min: 1, max: 100, fractionDigits: 2 });
      }
      if (type.includes("BOOL")) {
        return faker.datatype.boolean() ? 1 : 0;
      }
      if (type.includes("DATE") || type.includes("TIME")) {
        return faker.date.recent().toISOString().slice(0, 19).replace("T", " ");
      }
      return faker.word.noun();
  }
}

/**
 * Builds INSERT statements for mock data and executes them against the active adapter.
 */
export async function seedMockData(
  adapter: DatabaseAdapter,
  tables: TableInfo[],
  targetTableName: string,
  targetCount: number,
  columnConfigs: Record<string, Record<string, ColumnGenConfig>>, // table -> column -> config
  useTopologicalSort: boolean
): Promise<{ success: boolean; insertedCount: number; error: string | null }> {
  try {
    const sortedTables = useTopologicalSort 
      ? sortTablesTopologically(tables)
      : [tables.find(t => t.name === targetTableName)!].filter(Boolean);

    if (sortedTables.length === 0) {
      return { success: false, insertedCount: 0, error: "Target table not found in schema." };
    }

    // Keep track of primary keys generated or found in this session
    const generatedKeysMap = new Map<string, any[]>();
    let targetInsertedCount = 0;

    for (const table of sortedTables) {
      const isTarget = table.name === targetTableName;
      
      // Determine how many rows to generate for this table
      let countToGenerate = 0;
      if (isTarget) {
        countToGenerate = targetCount;
      } else if (useTopologicalSort) {
        // For parent tables in sorting mode, check if they are currently empty
        const countRes = await adapter.execute(`SELECT COUNT(*) FROM ${quoteIdent(table.name, adapter.id)};`);
        const currentCount = countRes.rows.length > 0 ? Number(countRes.rows[0][0]) : 0;
        if (currentCount === 0) {
          // Parent table is empty, auto-generate seed data
          countToGenerate = Math.max(10, Math.floor(targetCount / 2));
        }
      }

      // Collect existing primary keys from database to sample from
      const pkCol = table.columns.find(c => c.pk);
      if (pkCol) {
        const pkRes = await adapter.execute(`SELECT ${quoteIdent(pkCol.name, adapter.id)} FROM ${quoteIdent(table.name, adapter.id)} LIMIT 100;`);
        const existingKeys = pkRes.rows.map(r => r[0]);
        generatedKeysMap.set(table.name, existingKeys);
      }

      if (countToGenerate === 0) continue;

      // Table configs
      const configs = columnConfigs[table.name] || {};

      // Columns to insert
      const insertCols = table.columns.filter(c => !c.pk || !isAutoincrementType(c.type, c.defaultVal));
      const colNamesCsv = insertCols.map(c => quoteIdent(c.name, adapter.id)).join(", ");

      const rowsInserted: any[][] = [];

      for (let i = 0; i < countToGenerate; i++) {
        const rowValues: any[] = [];
        
        insertCols.forEach(col => {
          // Check if this column is a foreign key
          const fk = table.foreignKeys.find(f => f.column === col.name);
          let config = configs[col.name];

          if (fk) {
            // Automatically set FK config if not explicitly set
            config = config || { genType: "fk" };
          } else if (!config) {
            // Assign default config based on column type
            config = { genType: getDefaultGenType(col.type) };
          }

          // Fetch parent PK pool
          const pool = fk ? generatedKeysMap.get(fk.refTable) || [] : [];
          
          const val = generateCellMockValue(col, config, pool);
          rowValues.push(val);
        });

        // Generate insert SQL
        const valPlaceholder = rowValues.map(v => formatSqlValueForInsert(v, adapter.id)).join(", ");
        const insertSql = `INSERT INTO ${quoteIdent(table.name, adapter.id)} (${colNamesCsv}) VALUES (${valPlaceholder});`;
        
        const res = await adapter.execute(insertSql);
        if (res.error) {
          throw new Error(`Failed to insert seed row into "${table.name}": ${res.error}`);
        }

        // Fetch newly generated primary key (if autoincrement) to add to our local pool
        if (pkCol) {
          let pkVal: any = null;
          if (isAutoincrementType(pkCol.type, pkCol.defaultVal)) {
            // Fetch last insert id
            const idRes = await adapter.execute(getLastInsertIdSql(adapter.id, table.name, pkCol.name));
            if (idRes.rows.length > 0) {
              pkVal = idRes.rows[0][0];
            }
          } else {
            // Primary key was passed explicitly in insertCols
            const pkIdx = insertCols.findIndex(c => c.name === pkCol.name);
            if (pkIdx !== -1) {
              pkVal = rowValues[pkIdx];
            }
          }
          if (pkVal !== null && pkVal !== undefined) {
            const currentPool = generatedKeysMap.get(table.name) || [];
            currentPool.push(pkVal);
            generatedKeysMap.set(table.name, currentPool);
          }
        }
      }

      if (isTarget) {
        targetInsertedCount = countToGenerate;
      }
    }

    return { success: true, insertedCount: targetInsertedCount, error: null };
  } catch (err: any) {
    return { success: false, insertedCount: 0, error: err.message || String(err) };
  }
}

function quoteIdent(ident: string, driverId: string): string {
  const q = driverId === "mysql" ? "`" : '"';
  return `${q}${ident.replace(new RegExp(q, "g"), q + q)}${q}`;
}

function isAutoincrementType(type: string, defVal: string | null): boolean {
  const t = type.toUpperCase();
  const d = defVal?.toUpperCase() || "";
  return t.includes("SERIAL") || d.includes("AUTOINCREMENT") || d.includes("NEXTVAL");
}

function getDefaultGenType(type: string): ColumnGenConfig["genType"] {
  const t = type.toUpperCase();
  if (t.includes("INT")) return "number";
  if (t.includes("DOUBLE") || t === "REAL" || t === "FLOAT") return "number";
  if (t.includes("BOOL")) return "number"; // 1 or 0
  if (t.includes("DATE") || t.includes("TIME")) return "date";
  return "name"; // Fallback to name/text
}

function formatSqlValueForInsert(val: any, driverId: string): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  return `'${String(val).replace(/'/g, "''")}'`;
}

function getLastInsertIdSql(driverId: string, tableName: string, pkColName: string): string {
  if (driverId === "postgres") {
    return `SELECT currval(pg_get_serial_sequence('"${tableName}"', '${pkColName}'));`;
  }
  if (driverId === "mysql") {
    return "SELECT LAST_INSERT_ID();";
  }
  return "SELECT last_insert_rowid();";
}
