import { TableInfo } from "../db/adapters/adapter";

export function generateDrizzleSchema(tables: TableInfo[], driverId: string): string {
  const isPostgres = driverId === "postgres";
  const isMysql = driverId === "mysql";
  const isSqlite = !isPostgres && !isMysql;

  const coreImport = isPostgres 
    ? "pgTable" 
    : isMysql 
    ? "mysqlTable" 
    : "sqliteTable";
    
  const corePackage = isPostgres 
    ? "drizzle-orm/pg-core" 
    : isMysql 
    ? "drizzle-orm/mysql-core" 
    : "drizzle-orm/sqlite-core";

  // Accumulate type imports dynamically
  const typeImports = new Set<string>();

  let schemaCode = "";

  tables.forEach((table) => {
    schemaCode += `export const ${table.name} = ${coreImport}('${table.name}', {\n`;

    table.columns.forEach((col) => {
      let colDef = "";
      const colName = col.name;
      const rawType = col.type.toUpperCase();

      // PostgreSQL core maps
      if (isPostgres) {
        if (col.pk && (rawType.includes("INT") || rawType.includes("SERIAL"))) {
          typeImports.add("serial");
          colDef = `serial('${colName}')`;
        } else if (rawType.includes("INT")) {
          typeImports.add("integer");
          colDef = `integer('${colName}')`;
        } else if (rawType.includes("DOUBLE") || rawType === "REAL" || rawType === "FLOAT") {
          typeImports.add("real");
          colDef = `real('${colName}')`;
        } else if (rawType.includes("BOOL")) {
          typeImports.add("boolean");
          colDef = `boolean('${colName}')`;
        } else if (rawType.includes("DATE") || rawType.includes("TIME")) {
          typeImports.add("timestamp");
          colDef = `timestamp('${colName}')`;
        } else if (rawType.includes("VARCHAR")) {
          typeImports.add("varchar");
          colDef = `varchar('${colName}', { length: 255 })`;
        } else {
          typeImports.add("text");
          colDef = `text('${colName}')`;
        }
      } 
      // MySQL core maps
      else if (isMysql) {
        if (rawType.includes("INT")) {
          typeImports.add("int");
          colDef = `int('${colName}')`;
          if (col.pk) colDef += ".autoincrement()";
        } else if (rawType.includes("DOUBLE") || rawType === "REAL" || rawType === "FLOAT") {
          typeImports.add("double");
          colDef = `double('${colName}')`;
        } else if (rawType.includes("BOOL")) {
          typeImports.add("boolean");
          colDef = `boolean('${colName}')`;
        } else if (rawType.includes("DATE") || rawType.includes("TIME")) {
          typeImports.add("datetime");
          colDef = `datetime('${colName}')`;
        } else if (rawType.includes("VARCHAR")) {
          typeImports.add("varchar");
          colDef = `varchar('${colName}', { length: 255 })`;
        } else {
          typeImports.add("text");
          colDef = `text('${colName}')`;
        }
      } 
      // SQLite core maps
      else {
        if (rawType.includes("INT")) {
          typeImports.add("integer");
          colDef = `integer('${colName}')`;
        } else if (rawType.includes("DOUBLE") || rawType === "REAL" || rawType === "FLOAT") {
          typeImports.add("real");
          colDef = `real('${colName}')`;
        } else if (rawType.includes("BOOL") || rawType.includes("NUMERIC")) {
          typeImports.add("numeric");
          colDef = `numeric('${colName}')`;
        } else {
          typeImports.add("text");
          colDef = `text('${colName}')`;
        }
      }

      // Append modifiers
      if (col.pk) {
        // SQLite supports integer autoIncrement inside primaryKey config
        if (isSqlite && rawType.includes("INT")) {
          colDef += `.primaryKey({ autoIncrement: true })`;
        } else if (!isMysql || !rawType.includes("INT")) {
          // MySQL serial/int autoIncrement is separate from primaryKey() call, PG serial primaryKey is standard
          colDef += ".primaryKey()";
        } else {
          colDef += ".primaryKey()";
        }
      }
      if (col.notNull) colDef += ".notNull()";
      if (col.unique && !col.pk) colDef += ".unique()";
      
      // Default value modifiers
      if (col.defaultVal) {
        const val = col.defaultVal.toUpperCase();
        if (val === "NULL") {
          colDef += `.default(null)`;
        } else if (val.includes("NOW") || val.includes("CURRENT_TIMESTAMP")) {
          colDef += `.defaultNow()`;
        } else if (val.includes("AUTOINCREMENT")) {
          // Handled during type instantiation
        } else {
          let cleanVal = col.defaultVal;
          if ((cleanVal.startsWith("'") && cleanVal.endsWith("'")) || (cleanVal.startsWith('"') && cleanVal.endsWith('"'))) {
            cleanVal = cleanVal.slice(1, -1);
          }
          const isNum = !isNaN(Number(cleanVal)) && cleanVal.trim() !== "";
          colDef += isNum ? `.default(${cleanVal})` : `.default('${cleanVal.replace(/'/g, "\\'")}')`;
        }
      }

      // Foreign Key references
      const fk = table.foreignKeys.find((f) => f.column === col.name);
      if (fk) {
        colDef += `.references(() => ${fk.refTable}.${fk.refColumn})`;
      }

      schemaCode += `  ${colName}: ${colDef},\n`;
    });

    schemaCode += `});\n\n`;
  });

  // Assemble imports
  const importsArr = Array.from(typeImports).sort();
  const importsStr = `import { ${coreImport}, ${importsArr.join(", ")} } from '${corePackage}';\n\n`;

  return importsStr + schemaCode.trim() + "\n";
}
