import { NextResponse } from "next/server";
import { Pool as PgPool } from "pg";
import { createPool as createMysqlPool } from "mysql2/promise";
import { registerPool, DbDriver } from "../manager";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { driver, host, port, user, password, database, ssl } = body;

    if (!driver || !host || !port || !user || !database) {
      return NextResponse.json(
        { error: "Missing connection details. All fields are required except password." },
        { status: 400 }
      );
    }

    if (driver === "postgres") {
      const sslConfig = ssl ? { rejectUnauthorized: false } : false;
      const pool = new PgPool({
        host,
        port: Number(port),
        user,
        password,
        database,
        ssl: sslConfig,
        max: 5,
        connectionTimeoutMillis: 5000,
      });

      // Test the Postgres connection
      try {
        const client = await pool.connect();
        client.release();
      } catch (err: any) {
        await pool.end();
        return NextResponse.json(
          { error: `PostgreSQL Connection Failed: ${err.message || err}` },
          { status: 400 }
        );
      }

      const sessionId = registerPool("postgres", pool);
      return NextResponse.json({ sessionId, driver, database });

    } else if (driver === "mysql") {
      const sslConfig = ssl ? { rejectUnauthorized: false } : undefined;
      const pool = createMysqlPool({
        host,
        port: Number(port),
        user,
        password,
        database,
        ssl: sslConfig,
        connectionLimit: 5,
        connectTimeout: 5000,
      });

      // Test the MySQL connection
      try {
        const conn = await pool.getConnection();
        conn.release();
      } catch (err: any) {
        await pool.end();
        return NextResponse.json(
          { error: `MySQL Connection Failed: ${err.message || err}` },
          { status: 400 }
        );
      }

      const sessionId = registerPool("mysql", pool);
      return NextResponse.json({ sessionId, driver, database });

    } else {
      return NextResponse.json(
        { error: `Unsupported database driver: ${driver}` },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("Connection endpoint error:", err);
    return NextResponse.json(
      { error: `Internal Server Error: ${err.message || err}` },
      { status: 500 }
    );
  }
}
