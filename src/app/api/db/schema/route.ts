import { NextResponse } from "next/server";
import { Pool as PgPool } from "pg";
import { Pool as MysqlPool } from "mysql2/promise";
import { getPool } from "../manager";

export interface ColumnInfo {
  name: string;
  type: string;
  pk: boolean;
  unique: boolean;
  notNull: boolean;
  defaultVal: string | null;
}

export interface ForeignKeyInfo {
  column: string;
  refTable: string;
  refColumn: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  checkConstraints: string[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId parameter." }, { status: 400 });
    }

    const poolInfo = getPool(sessionId);
    if (!poolInfo) {
      return NextResponse.json({ error: "Session connection expired or not found." }, { status: 401 });
    }

    const { driver, pool } = poolInfo;
    const tablesMap = new Map<string, TableInfo>();

    if (driver === "postgres") {
      const pgPool = pool as PgPool;
      
      // 1. Fetch tables list
      const tablesRes = await pgPool.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name;`
      );
      const tableNames = tablesRes.rows.map((r) => r.table_name);

      tableNames.forEach((name) => {
        tablesMap.set(name, {
          name,
          columns: [],
          foreignKeys: [],
          checkConstraints: [],
        });
      });

      // 2. Fetch all columns in public schema
      const columnsRes = await pgPool.query(`
        SELECT 
          c.table_name,
          c.column_name, 
          c.data_type, 
          c.column_default, 
          c.is_nullable,
          (SELECT count(*) FROM information_schema.table_constraints tc 
           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = c.table_name AND kcu.column_name = c.column_name) > 0 as is_pk,
          (SELECT count(*) FROM information_schema.table_constraints tc 
           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = c.table_name AND kcu.column_name = c.column_name) > 0 as is_unique
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      `);

      columnsRes.rows.forEach((colRow) => {
        const table = tablesMap.get(colRow.table_name);
        if (table) {
          table.columns.push({
            name: colRow.column_name,
            type: colRow.data_type,
            pk: Boolean(colRow.is_pk),
            unique: Boolean(colRow.is_unique),
            notNull: colRow.is_nullable === "NO",
            defaultVal: colRow.column_default !== null ? String(colRow.column_default) : null,
          });
        }
      });

      // 3. Fetch all foreign keys in public schema
      const fkRes = await pgPool.query(`
        SELECT
          tc.table_name AS source_table,
          kcu.column_name AS source_column,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
      `);

      fkRes.rows.forEach((fkRow) => {
        const table = tablesMap.get(fkRow.source_table);
        if (table) {
          table.foreignKeys.push({
            column: fkRow.source_column,
            refTable: fkRow.referenced_table,
            refColumn: fkRow.referenced_column,
          });
        }
      });

      // 4. Fetch CHECK constraints
      const checkRes = await pgPool.query(`
        SELECT
          tc.table_name,
          cc.check_clause
        FROM
          information_schema.table_constraints tc
          JOIN information_schema.check_constraints cc
            ON tc.constraint_name = cc.constraint_name
            AND tc.table_schema = cc.constraint_schema
        WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public';
      `);

      checkRes.rows.forEach((checkRow) => {
        const table = tablesMap.get(checkRow.table_name);
        if (table) {
          table.checkConstraints.push(checkRow.check_clause);
        }
      });

    } else if (driver === "mysql") {
      const mysqlPool = pool as MysqlPool;
      
      // Determine active database name in MySQL pool
      const mysqlConfig = mysqlPool.config as any;
      const dbName = mysqlConfig?.connectionConfig?.database || "";

      // 1. Fetch tables list
      const [tableRows] = await mysqlPool.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_schema = ? AND table_type = 'BASE TABLE'
         ORDER BY table_name;`,
        [dbName]
      );
      
      (tableRows as any[]).forEach((row) => {
        tablesMap.set(row.table_name, {
          name: row.table_name,
          columns: [],
          foreignKeys: [],
          checkConstraints: [],
        });
      });

      // 2. Fetch all columns
      const [columnRows] = await mysqlPool.query(
        `SELECT 
          table_name,
          column_name, 
          data_type, 
          column_default, 
          is_nullable,
          column_key
        FROM information_schema.columns
        WHERE table_schema = ?
        ORDER BY table_name, ordinal_position;`,
        [dbName]
      );

      (columnRows as any[]).forEach((colRow) => {
        const table = tablesMap.get(colRow.table_name);
        if (table) {
          table.columns.push({
            name: colRow.column_name,
            type: colRow.data_type,
            pk: colRow.column_key === "PRI",
            unique: colRow.column_key === "UNI",
            notNull: colRow.is_nullable === "NO",
            defaultVal: colRow.column_default !== null ? String(colRow.column_default) : null,
          });
        }
      });

      // 3. Fetch foreign keys
      const [fkRows] = await mysqlPool.query(
        `SELECT 
          table_name AS source_table,
          column_name AS source_column,
          referenced_table_name AS referenced_table,
          referenced_column_name AS referenced_column
        FROM
          information_schema.key_column_usage
        WHERE
          table_schema = ?
          AND referenced_table_name IS NOT NULL;`,
        [dbName]
      );

      (fkRows as any[]).forEach((fkRow) => {
        const table = tablesMap.get(fkRow.source_table);
        if (table) {
          table.foreignKeys.push({
            column: fkRow.source_column,
            refTable: fkRow.referenced_table,
            refColumn: fkRow.referenced_column,
          });
        }
      });

      // 4. Fetch CHECK constraints (Wrap in try/catch to support MySQL < 8 where this table doesn't exist)
      try {
        const [checkRows] = await mysqlPool.query(
          `SELECT 
            tc.table_name,
            cc.check_clause
          FROM 
            information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc 
              ON tc.constraint_name = cc.constraint_name
              AND tc.table_schema = cc.constraint_schema
          WHERE 
            tc.constraint_type = 'CHECK' 
            AND tc.table_schema = ?;`,
          [dbName]
        );

        (checkRows as any[]).forEach((checkRow) => {
          const table = tablesMap.get(checkRow.table_name);
          if (table) {
            table.checkConstraints.push(checkRow.check_clause);
          }
        });
      } catch (err) {
        console.warn("[Proxy] Skip CHECK constraints query. MySQL version might not support it:", err);
      }
    }

    // Convert map to list
    const tablesList = Array.from(tablesMap.values());
    return NextResponse.json({ tables: tablesList });

  } catch (err: any) {
    console.error("Schema endpoint error:", err);
    return NextResponse.json(
      { error: `Failed to query schema: ${err.message || err}` },
      { status: 500 }
    );
  }
}
