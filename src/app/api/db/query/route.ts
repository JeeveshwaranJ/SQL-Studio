import { NextResponse } from "next/server";
import { Pool as PgPool } from "pg";
import { Pool as MysqlPool } from "mysql2/promise";
import { getPool } from "../manager";

export async function POST(request: Request) {
  let pgClient: any = null;
  let mysqlConn: any = null;
  let isAborted = false;

  try {
    const body = await request.json();
    const { sessionId, sql } = body;

    if (!sessionId || !sql) {
      return NextResponse.json(
        { error: "Missing sessionId or query SQL text." },
        { status: 400 }
      );
    }

    const poolInfo = getPool(sessionId);
    if (!poolInfo) {
      return NextResponse.json(
        { error: "Session connection expired or not found. Please reconnect." },
        { status: 401 }
      );
    }

    const startTime = performance.now();
    const { driver, pool } = poolInfo;

    // Detect if client disconnected
    request.signal.addEventListener("abort", async () => {
      isAborted = true;
      try {
        if (driver === "postgres" && pgClient) {
          const pid = pgClient.processID;
          console.log(`[Proxy] Client aborted. Cancelling PostgreSQL query pid: ${pid}`);
          // Execute cancellation using a different client from pool
          await (pool as PgPool).query(`SELECT pg_cancel_backend(${pid});`);
        } else if (driver === "mysql" && mysqlConn) {
          const threadId = mysqlConn.threadId;
          console.log(`[Proxy] Client aborted. Killing MySQL query thread: ${threadId}`);
          await (pool as MysqlPool).query(`KILL QUERY ${threadId};`);
        }
      } catch (err) {
        console.error("[Proxy] Query cancellation failed:", err);
      } finally {
        if (pgClient) pgClient.release();
        if (mysqlConn) mysqlConn.release();
      }
    });

    if (driver === "postgres") {
      const pgPool = pool as PgPool;
      pgClient = await pgPool.connect();

      if (isAborted) {
        pgClient.release();
        return NextResponse.json({ error: "Query aborted by client" }, { status: 499 });
      }

      // Execute query in raw array format
      const res = await pgClient.query({
        text: sql,
        rowMode: "array",
      });

      const endTime = performance.now();
      pgClient.release();
      pgClient = null; // Prevent duplicate release in catch/finally

      // pg returns arrays or a single result object. If running multiple queries, it might return an array of results.
      const resultObj = Array.isArray(res) ? res[res.length - 1] : res;
      
      const columns = resultObj.fields ? resultObj.fields.map((f: any) => f.name) : [];
      const rows = resultObj.rows || [];
      const executionTime = Math.round(endTime - startTime);

      return NextResponse.json({
        columns,
        rows,
        executionTime,
        error: null,
      });

    } else if (driver === "mysql") {
      const mysqlPool = pool as MysqlPool;
      mysqlConn = await mysqlPool.getConnection();

      if (isAborted) {
        mysqlConn.release();
        return NextResponse.json({ error: "Query aborted by client" }, { status: 499 });
      }

      // Execute query returning rows as arrays
      const [resRows, fields] = await mysqlConn.query({
        sql,
        rowsAsArray: true,
      });

      const endTime = performance.now();
      mysqlConn.release();
      mysqlConn = null;

      // Map column headers
      const columns = fields ? (fields as any[]).map((f) => f.name) : [];
      
      // If it's a bulk query or DDL, rows might not be an array of arrays (e.g. OkPacket info).
      // We check if rows is an array of arrays or values.
      const rows = Array.isArray(resRows) ? resRows : [];
      const executionTime = Math.round(endTime - startTime);

      return NextResponse.json({
        columns,
        rows,
        executionTime,
        error: null,
      });
    }

  } catch (err: any) {
    if (pgClient) {
      try { pgClient.release(); } catch (e) {}
    }
    if (mysqlConn) {
      try { mysqlConn.release(); } catch (e) {}
    }

    const errorMessage = err?.message || String(err);
    console.error("[Proxy] Query execution error:", errorMessage);

    return NextResponse.json({
      columns: [],
      rows: [],
      executionTime: 0,
      error: errorMessage,
    });
  }
}
