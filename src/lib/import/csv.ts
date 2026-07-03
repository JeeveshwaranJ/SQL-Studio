/**
 * Parses CSV raw text into a string matrix, handling commas, quoting, and escaped quotes.
 */
export function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = "";
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    
    if (c === '"') {
      // Lookahead check for escaped double quotes: ""
      if (inQuotes && text[i + 1] === '"') {
        entry += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push(entry.trim());
      entry = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++; // CRLF check
      row.push(entry.trim());
      lines.push(row);
      row = [];
      entry = "";
    } else {
      entry += c;
    }
  }
  
  if (entry || row.length > 0) {
    row.push(entry.trim());
    lines.push(row);
  }
  
  // Filter out any trailing empty rows
  return lines.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

/**
 * Scans columns to infer optimal SQLite/SQL data types.
 */
export function inferColumnTypes(headers: string[], dataRows: string[][]): string[] {
  return headers.map((_, colIdx) => {
    let isInt = true;
    let isReal = true;
    let isBool = true;
    let hasData = false;

    for (const row of dataRows) {
      const val = row[colIdx]?.trim();
      if (!val || val.toUpperCase() === "NULL") continue; // Skip blank values
      hasData = true;

      // Check Integer
      if (isInt && !/^-?\d+$/.test(val)) {
        isInt = false;
      }
      
      // Check Real Numeric
      if (isReal && !/^-?\d+(\.\d+)?$/.test(val)) {
        isReal = false;
      }
      
      // Check Boolean
      const valLower = val.toLowerCase();
      if (isBool && valLower !== "true" && valLower !== "false" && val !== "1" && val !== "0") {
        isBool = false;
      }
    }

    if (!hasData) return "TEXT";
    if (isBool) return "BOOLEAN";
    if (isInt) return "INTEGER";
    if (isReal) return "REAL";
    return "TEXT";
  });
}
