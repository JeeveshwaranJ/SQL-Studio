import { TableInfo } from "../db/adapters/adapter";

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function mapPrismaType(sqlType: string): string {
  const type = sqlType.toUpperCase();
  if (type.includes("INT") || type.includes("SERIAL")) return "Int";
  if (type.includes("CHAR") || type === "TEXT" || type === "CLOB") return "String";
  if (type.includes("DOUBLE") || type === "REAL" || type === "FLOAT") return "Float";
  if (type.includes("DECIMAL") || type.includes("NUMERIC")) return "Decimal";
  if (type.includes("BOOL")) return "Boolean";
  if (type.includes("DATE") || type.includes("TIME")) return "DateTime";
  if (type === "BLOB" || type === "BYTEA") return "Bytes";
  return "String"; // Fallback
}

function formatPrismaDefault(val: string, type: string): string {
  const upperType = type.toUpperCase();
  if (val.toUpperCase() === "NULL") return "null";
  if (val.toLowerCase().startsWith("nextval") || val.toLowerCase().includes("autoincrement")) {
    return "autoincrement()";
  }
  if (val.toLowerCase().includes("now") || val.toLowerCase().includes("current_timestamp")) {
    return "now()";
  }
  
  // Clean string quotes if present
  let cleanVal = val;
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    cleanVal = val.slice(1, -1);
  }

  if (upperType.includes("INT") || upperType.includes("REAL") || upperType.includes("FLOAT")) {
    return isNaN(Number(cleanVal)) ? "dbgenerated()" : cleanVal;
  }
  if (upperType.includes("BOOL")) {
    return cleanVal === "1" || cleanVal.toLowerCase() === "true" ? "true" : "false";
  }
  return `"${cleanVal}"`;
}

export function generatePrismaSchema(tables: TableInfo[], driverId: string): string {
  const provider = driverId === "postgres" ? "postgresql" : driverId === "mysql" ? "mysql" : "sqlite";
  
  let schema = `datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

`;

  tables.forEach((table) => {
    schema += `model ${capitalize(table.name)} {\n`;
    
    table.columns.forEach((col) => {
      const type = mapPrismaType(col.type);
      let decorators = "";
      
      if (col.pk) decorators += " @id";
      if (col.unique && !col.pk) decorators += " @unique";
      if (col.defaultVal) {
        decorators += ` @default(${formatPrismaDefault(col.defaultVal, col.type)})`;
      }
      
      // Relation fields in Prisma require a separate relation model handle
      const fk = table.foreignKeys.find((f) => f.column === col.name);
      if (fk) {
        schema += `  ${col.name} ${type}${col.notNull ? "" : "?"}${decorators}\n`;
        schema += `  ${fk.refTable.toLowerCase()} ${capitalize(fk.refTable)} @relation(fields: [${col.name}], references: [${fk.refColumn}])\n`;
      } else {
        schema += `  ${col.name} ${type}${col.notNull ? "" : "?"}${decorators}\n`;
      }
    });
    
    schema += `}\n\n`;
  });
  
  return schema.trim() + "\n";
}
