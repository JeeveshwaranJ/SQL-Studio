import { Pool as PgPool } from "pg";
import { createPool as createMysqlPool, Pool as MysqlPool } from "mysql2/promise";
import crypto from "crypto";

export type DbDriver = "postgres" | "mysql";

export interface ConnectionPoolInfo {
  id: string;
  driver: DbDriver;
  pool: PgPool | MysqlPool;
  lastUsed: number;
}

// In-memory registry of active pools
const activePools = new Map<string, ConnectionPoolInfo>();

// Prune idle connections every 5 minutes (idle threshold: 15 minutes)
if (typeof global !== "undefined") {
  const globalAny = global as any;
  if (!globalAny.dbConnectionPrunerSet) {
    globalAny.dbConnectionPrunerSet = true;
    setInterval(() => {
      const now = Date.now();
      const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
      for (const [id, info] of activePools.entries()) {
        if (now - info.lastUsed > IDLE_TIMEOUT) {
          console.log(`[Proxy] Pruning idle connection pool ${id} (${info.driver})`);
          info.pool.end().catch((err) => console.error(`[Proxy] Error ending pruned pool ${id}:`, err));
          activePools.delete(id);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }
}

export function registerPool(driver: DbDriver, pool: PgPool | MysqlPool): string {
  const sessionId = crypto.randomUUID();
  activePools.set(sessionId, {
    id: sessionId,
    driver,
    pool,
    lastUsed: Date.now(),
  });
  return sessionId;
}

export function getPool(sessionId: string): ConnectionPoolInfo | undefined {
  const info = activePools.get(sessionId);
  if (info) {
    info.lastUsed = Date.now();
  }
  return info;
}

export function removePool(sessionId: string): boolean {
  const info = activePools.get(sessionId);
  if (info) {
    info.pool.end().catch((err) => console.error(`[Proxy] Error closing pool ${sessionId}:`, err));
    activePools.delete(sessionId);
    return true;
  }
  return false;
}
