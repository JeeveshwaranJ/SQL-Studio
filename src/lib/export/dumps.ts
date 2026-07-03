/**
 * Formats a value for inclusion in SQL insert statements.
 */
function formatSqlValue(val: any, driverId: string): string {
  if (val === null || val === undefined) return "NULL";
  
  if (typeof val === "number") {
    return isNaN(val) ? "NULL" : String(val);
  }
  
  if (typeof val === "boolean") {
    if (driverId === "postgres") return val ? "true" : "false";
    return val ? "1" : "0";
  }
  
  if (val instanceof Date) {
    return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
  }

  if (typeof val === "object") {
    const strVal = JSON.stringify(val);
    return `'${strVal.replace(/'/g, "''")}'`;
  }
  
  // String escaping
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Generates SQL INSERT statements for full table dumps or query results.
 */
export function generateSqlDump(
  tableName: string,
  columns: string[],
  rows: any[][],
  driverId: string
): string {
  const quote = driverId === "mysql" ? "`" : '"';
  const escapedTableName = `${quote}${tableName.replace(new RegExp(quote, "g"), quote + quote)}${quote}`;
  
  const escapedColumns = columns
    .map((col) => `${quote}${col.replace(new RegExp(quote, "g"), quote + quote)}${quote}`)
    .join(", ");

  let sql = `-- SQL Studio Table Dump\n`;
  sql += `-- Engine: ${driverId.toUpperCase()}\n`;
  sql += `-- Created at: ${new Date().toISOString()}\n\n`;

  rows.forEach((row) => {
    const formattedValues = row.map((val) => formatSqlValue(val, driverId)).join(", ");
    sql += `INSERT INTO ${escapedTableName} (${escapedColumns}) VALUES (${formattedValues});\n`;
  });

  return sql;
}

/**
 * Exports columns and rows to RFC-4180 CSV text.
 */
export function exportToCsv(columns: string[], rows: any[][]): string {
  const escapeCsvCell = (cell: any): string => {
    if (cell === null || cell === undefined) return "";
    let str = String(cell);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = columns.map(escapeCsvCell).join(",");
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  
  return headers + "\n" + body;
}

/**
 * Exports columns and rows to an array of JSON objects.
 */
export function exportToJson(columns: string[], rows: any[][]): string {
  const objects = rows.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
  
  return JSON.stringify(objects, null, 2);
}
