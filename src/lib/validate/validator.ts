import { TableSchema } from "../store/dbStore";
import { ValidationProblem } from "../sql/dialects/dialect";

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON",
  "AND", "OR", "NOT", "IN", "LIKE", "IS", "NULL", "ORDER", "BY", "GROUP", "HAVING",
  "LIMIT", "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "AS", "CREATE", "TABLE", "DROP", "ALTER", "ADD", "COLUMN", "KEY", "PRIMARY",
  "FOREIGN", "REFERENCES", "INDEX", "UNIQUE", "DEFAULT", "CHECK", "CONSTRAINT",
  "TRUE", "FALSE", "INT", "INTEGER", "TEXT", "VARCHAR", "BOOLEAN", "REAL", "BLOB",
  "DATETIME", "TIMESTAMP", "COUNT", "SUM", "AVG", "MAX", "MIN", "NOW", "DATE",
  "ON", "CASCADE", "EXISTS", "BETWEEN", "CASE", "WHEN", "THEN", "ELSE", "END", "UNION", "ALL"
]);

/**
 * Validates a SQL query string against the live active database schema.
 */
export function validateSqlQuery(sql: string, tables: TableSchema[]): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  if (!sql.trim()) return problems;

  const lines = sql.split("\n");
  
  // 1. Analyze multiple statements and check for missing semicolons
  // We identify start indices of multiple main DML queries: SELECT, INSERT, UPDATE, DELETE
  const dmlRegex = /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i;
  const dmlPositions: { lineIdx: number; queryType: string }[] = [];
  
  lines.forEach((line, idx) => {
    // Strip comments first
    const cleanLine = line.replace(/--.*$/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const match = cleanLine.match(dmlRegex);
    if (match) {
      dmlPositions.push({ lineIdx: idx, queryType: match[1].toUpperCase() });
    }
  });

  // If there are multiple queries, verify if preceding lines ended with a semicolon
  for (let i = 1; i < dmlPositions.length; i++) {
    const prevQueryLine = dmlPositions[i - 1].lineIdx;
    const currentQueryLine = dmlPositions[i].lineIdx;
    
    // Look at text between queries
    let hasSemicolon = false;
    for (let l = prevQueryLine; l < currentQueryLine; l++) {
      if (lines[l].includes(";")) {
        hasSemicolon = true;
        break;
      }
    }

    if (!hasSemicolon) {
      problems.push({
        line: currentQueryLine + 1,
        column: 1,
        severity: "warning",
        message: `Missing semicolon before starting the next statement ("${dmlPositions[i].queryType}").`,
      });
    }
  }

  // 2. Perform statement-level validations
  // Split sql by semicolon to check each query block
  const statements = sql.split(";");
  let accumulatedLines = 0;

  statements.forEach((stmt) => {
    const cleanStmt = stmt
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();

    if (!cleanStmt) {
      accumulatedLines += stmt.split("\n").length - 1;
      return;
    }

    const stmtStartLine = accumulatedLines + 1;
    const stmtLinesCount = stmt.split("\n").length;
    const stmtUpper = cleanStmt.toUpperCase();

    // -- CHECK: Missing WHERE on UPDATE / DELETE
    if (/^\s*(UPDATE|DELETE)\b/i.test(cleanStmt) && !/\bWHERE\b/i.test(cleanStmt)) {
      problems.push({
        line: stmtStartLine,
        column: 1,
        severity: "warning",
        message: `UPDATE/DELETE statement missing WHERE clause. This will affect all rows in the table.`,
      });
    }

    // -- CHECK: SELECT * anti-pattern
    if (/^\s*SELECT\s+\*/i.test(cleanStmt)) {
      problems.push({
        line: stmtStartLine,
        column: 8,
        severity: "info",
        message: `Avoid using "SELECT *" in production-ready queries. List column names explicitly.`,
      });
    }

    // 3. Entity validations (Tables & Columns existence checks)
    const tableRefs = new Set<string>();
    
    // Regex matches table references
    const fromJoinMatches = cleanStmt.matchAll(/\b(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+["`]?([a-zA-Z_]\w*)["`]?/gi);
    for (const match of fromJoinMatches) {
      if (match[1] && !SQL_KEYWORDS.has(match[1].toUpperCase())) {
        tableRefs.add(match[1].toLowerCase());
      }
    }

    // Check if referenced tables exist
    tableRefs.forEach((tableName) => {
      const tableExists = tables.some((t) => t.name.toLowerCase() === tableName);
      if (!tableExists && tables.length > 0) {
        let refLine = stmtStartLine;
        for (let l = 0; l < stmtLinesCount; l++) {
          const absoluteLine = stmtStartLine + l - 1;
          if (absoluteLine < lines.length && lines[absoluteLine].toLowerCase().includes(tableName)) {
            refLine = absoluteLine + 1;
            break;
          }
        }

        problems.push({
          line: refLine,
          column: 1,
          severity: "error",
          message: `Table "${tableName}" does not exist in the active database schema.`,
        });
      }
    });

    // Resolve column references:
    const referencedColumns: { name: string; tableName: string | null; line: number }[] = [];

    // Find line-by-line column references
    const stmtLines = stmt.split("\n");
    stmtLines.forEach((sLine, lineOffset) => {
      const absLine = stmtStartLine + lineOffset;
      const cleanLine = sLine.replace(/--.*$/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (!cleanLine) return;

      const qualifiedMatches = cleanLine.matchAll(/(?:["`]?([a-zA-Z_]\w*)["`]?\.)?["`]?([a-zA-Z_]\w*)["`]?/g);
      for (const match of qualifiedMatches) {
        const tablePart = match[1];
        const colPart = match[2];
        
        if (!colPart || SQL_KEYWORDS.has(colPart.toUpperCase())) continue;

        if (tablePart) {
          if (!SQL_KEYWORDS.has(tablePart.toUpperCase())) {
            referencedColumns.push({
              name: colPart.toLowerCase(),
              tableName: tablePart.toLowerCase(),
              line: absLine,
            });
          }
        } else {
          referencedColumns.push({
            name: colPart.toLowerCase(),
            tableName: null,
            line: absLine,
          });
        }
      }
    });

    // Check if columns exist in referenced tables
    const activeTables = tables.filter((t) => tableRefs.has(t.name.toLowerCase()));
    
    if (activeTables.length > 0) {
      referencedColumns.forEach((colRef) => {
        if (colRef.tableName) {
          // If table qualified, verify it exists and column exists in it
          const matchingTable = activeTables.find((t) => t.name.toLowerCase() === colRef.tableName);
          if (matchingTable) {
            const colExists = matchingTable.columns.some((c) => c.name.toLowerCase() === colRef.name);
            if (!colExists) {
              problems.push({
                line: colRef.line,
                column: 1,
                severity: "error",
                message: `Column "${colRef.name}" does not exist on table "${colRef.tableName}".`,
              });
            }
          }
        } else {
          // Plain column: check if it exists in ANY of the referenced tables
          // Avoid triggering errors for standard table aliases (e.g. u, o) or aggregate variables
          const matchesAny = activeTables.some((t) =>
            t.columns.some((c) => c.name.toLowerCase() === colRef.name)
          );

          // We also ignore aliases matching table references themselves
          const isTableAlias = tableRefs.has(colRef.name);

          if (!matchesAny && !isTableAlias && colRef.name.length > 1) {
            problems.push({
              line: colRef.line,
              column: 1,
              severity: "error",
              message: `Column "${colRef.name}" does not exist in the referenced tables.`,
            });
          }
        }
      });
    }

    // -- CHECK: JOIN column mismatch
    const joinMatches = cleanStmt.matchAll(/JOIN\s+["`]?(\w+)["`]?\s+(?:AS\s+)?(\w+)?\s+ON\s+["`]?(\w+)["`]?\.["`]?(\w+)["`]?\s*=\s*["`]?(\w+)["`]?\.["`]?(\w+)["`]?/gi);
    for (const match of joinMatches) {
      const table1 = match[3].toLowerCase();
      const col1 = match[4].toLowerCase();
      const table2 = match[5].toLowerCase();
      const col2 = match[6].toLowerCase();

      // Find types in schemas
      const t1Schema = tables.find((t) => t.name.toLowerCase() === table1 || t.name.toLowerCase() === match[2]?.toLowerCase());
      const t2Schema = tables.find((t) => t.name.toLowerCase() === table2);

      if (t1Schema && t2Schema) {
        const c1Type = t1Schema.columns.find((c) => c.name.toLowerCase() === col1)?.type.toUpperCase() || "";
        const c2Type = t2Schema.columns.find((c) => c.name.toLowerCase() === col2)?.type.toUpperCase() || "";

        if (c1Type && c2Type) {
          const isT1Int = c1Type.includes("INT") || c1Type.includes("SERIAL");
          const isT2Int = c2Type.includes("INT") || c2Type.includes("SERIAL");
          const isT1Text = c1Type.includes("CHAR") || c1Type.includes("TEXT");
          const isT2Text = c2Type.includes("CHAR") || c2Type.includes("TEXT");

          // Warn if joining incompatible types
          if ((isT1Int && isT2Text) || (isT1Text && isT2Int)) {
            problems.push({
              line: stmtStartLine,
              column: 1,
              severity: "warning",
              message: `Type mismatch in JOIN predicate: comparing "${table1}.${col1}" (${c1Type}) vs "${table2}.${col2}" (${c2Type}).`,
            });
          }
        }
      }
    }

    accumulatedLines += stmtLinesCount - 1;
  });

  return problems;
}
