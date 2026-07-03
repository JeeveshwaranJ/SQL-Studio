export interface ParsedJsonResult {
  headers: string[];
  rows: any[][];
  inferredTypes: string[];
}

/**
 * Parses a JSON array of objects, collects all unique property keys as column headers,
 * constructs row matrices, and infers optimal data type definitions.
 */
export function parseJsonImport(jsonText: string): ParsedJsonResult {
  const parsed = JSON.parse(jsonText);
  
  if (!Array.isArray(parsed)) {
    throw new Error("JSON import data source must be an array of objects.");
  }
  
  if (parsed.length === 0) {
    return { headers: [], rows: [], inferredTypes: [] };
  }

  // 1. Gather all unique property keys across all objects (accounts for sparse fields)
  const headersSet = new Set<string>();
  parsed.forEach((obj) => {
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((key) => headersSet.add(key));
    }
  });
  const headers = Array.from(headersSet);

  // 2. Assemble rows values matrix
  const rows: any[][] = [];
  parsed.forEach((obj) => {
    const row = headers.map((header) => {
      const val = obj[header];
      return val === undefined ? null : val;
    });
    rows.push(row);
  });

  // 3. Infer column types based on property types
  const inferredTypes = headers.map((_, colIdx) => {
    let isInt = true;
    let isReal = true;
    let isBool = true;
    let hasData = false;

    for (const row of rows) {
      const val = row[colIdx];
      if (val === null || val === undefined) continue;
      hasData = true;

      const valType = typeof val;
      if (valType === "boolean") {
        isInt = false;
        isReal = false;
      } else if (valType === "number") {
        isBool = false;
        if (isInt && !Number.isInteger(val)) {
          isInt = false;
        }
      } else {
        // String representation check
        isBool = false;
        const valStr = String(val).trim();
        
        // Integer test
        if (isInt && !/^-?\d+$/.test(valStr)) {
          isInt = false;
        }
        
        // Numeric real test
        if (isReal && !/^-?\d+(\.\d+)?$/.test(valStr)) {
          isReal = false;
        }
      }
    }

    if (!hasData) return "TEXT";
    if (isBool) return "BOOLEAN";
    if (isInt) return "INTEGER";
    if (isReal) return "REAL";
    return "TEXT";
  });

  return { headers, rows, inferredTypes };
}
