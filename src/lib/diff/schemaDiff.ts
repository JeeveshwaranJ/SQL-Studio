import { SchemaModel, TableModel, ColumnModel, ForeignKeyModel } from "../schema/parser";

export interface ColumnModification {
  columnName: string;
  oldColumn: ColumnModel;
  newColumn: ColumnModel;
  typeChanged: boolean;
  nullabilityChanged: boolean;
  defaultChanged: boolean;
}

export interface TableModification {
  tableName: string;
  sourceTable: TableModel;
  targetTable: TableModel;
  addedColumns: ColumnModel[];
  removedColumns: string[];
  modifiedColumns: ColumnModification[];
  addedForeignKeys: ForeignKeyModel[];
  removedForeignKeys: ForeignKeyModel[];
}

export interface SchemaDiff {
  addedTables: TableModel[];
  removedTables: string[];
  modifiedTables: Record<string, TableModification>;
}

/**
 * Structural comparison engine between two database schemas.
 */
export function diffSchemas(source: SchemaModel, target: SchemaModel): SchemaDiff {
  const addedTables: TableModel[] = [];
  const removedTables: string[] = [];
  const modifiedTables: Record<string, TableModification> = {};

  const sourceTableMap = new Map<string, TableModel>();
  source.tables.forEach((t) => sourceTableMap.set(t.name, t));

  const targetTableMap = new Map<string, TableModel>();
  target.tables.forEach((t) => targetTableMap.set(t.name, t));

  // 1. Added Tables
  target.tables.forEach((targetTable) => {
    if (!sourceTableMap.has(targetTable.name)) {
      addedTables.push(targetTable);
    }
  });

  // 2. Removed Tables
  source.tables.forEach((sourceTable) => {
    if (!targetTableMap.has(sourceTable.name)) {
      removedTables.push(sourceTable.name);
    }
  });

  // 3. Modified Tables
  target.tables.forEach((targetTable) => {
    const sourceTable = sourceTableMap.get(targetTable.name);
    if (!sourceTable) return;

    const addedColumns: ColumnModel[] = [];
    const removedColumns: string[] = [];
    const modifiedColumns: ColumnModification[] = [];
    const addedForeignKeys: ForeignKeyModel[] = [];
    const removedForeignKeys: ForeignKeyModel[] = [];

    // Columns maps
    const sourceColMap = new Map<string, ColumnModel>();
    sourceTable.columns.forEach((c) => sourceColMap.set(c.name, c));

    const targetColMap = new Map<string, ColumnModel>();
    targetTable.columns.forEach((c) => targetColMap.set(c.name, c));

    // Column additions and modifications
    targetTable.columns.forEach((targetCol) => {
      const sourceCol = sourceColMap.get(targetCol.name);
      if (!sourceCol) {
        addedColumns.push(targetCol);
      } else {
        const typeChanged = sourceCol.type.toLowerCase().trim() !== targetCol.type.toLowerCase().trim();
        const nullabilityChanged = sourceCol.notNull !== targetCol.notNull;
        
        // Clean default values comparison (removes quote discrepancies)
        const defA = sourceCol.defaultVal 
          ? sourceCol.defaultVal.trim().replace(/^['"\s(]+|['"\s)]+$/g, "") 
          : null;
        const defB = targetCol.defaultVal 
          ? targetCol.defaultVal.trim().replace(/^['"\s(]+|['"\s)]+$/g, "") 
          : null;
        const defaultChanged = defA !== defB;

        if (typeChanged || nullabilityChanged || defaultChanged) {
          modifiedColumns.push({
            columnName: targetCol.name,
            oldColumn: sourceCol,
            newColumn: targetCol,
            typeChanged,
            nullabilityChanged,
            defaultChanged,
          });
        }
      }
    });

    // Column removals
    sourceTable.columns.forEach((sourceCol) => {
      if (!targetColMap.has(sourceCol.name)) {
        removedColumns.push(sourceCol.name);
      }
    });

    // Foreign Keys additions
    targetTable.foreignKeys.forEach((targetFk) => {
      const exists = sourceTable.foreignKeys.some((sfk) => 
        sfk.column === targetFk.column && 
        sfk.refTable === targetFk.refTable && 
        sfk.refColumn === targetFk.refColumn
      );
      if (!exists) {
        addedForeignKeys.push(targetFk);
      }
    });

    // Foreign Keys removals
    sourceTable.foreignKeys.forEach((sourceFk) => {
      const exists = targetTable.foreignKeys.some((tfk) => 
        tfk.column === sourceFk.column && 
        tfk.refTable === sourceFk.refTable && 
        tfk.refColumn === sourceFk.refColumn
      );
      if (!exists) {
        removedForeignKeys.push(sourceFk);
      }
    });

    // Register table modifications if any exist
    if (
      addedColumns.length > 0 ||
      removedColumns.length > 0 ||
      modifiedColumns.length > 0 ||
      addedForeignKeys.length > 0 ||
      removedForeignKeys.length > 0
    ) {
      modifiedTables[targetTable.name] = {
        tableName: targetTable.name,
        sourceTable,
        targetTable,
        addedColumns,
        removedColumns,
        modifiedColumns,
        addedForeignKeys,
        removedForeignKeys,
      };
    }
  });

  return { addedTables, removedTables, modifiedTables };
}
