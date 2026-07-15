import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/drizzle/schema";
import { normalizeSourceUrl } from "@/lib/source-urls";

export function openDatabase(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sqlite = new Database(filePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export type DatabaseConnection = ReturnType<typeof openDatabase>;
export type DatabaseClient = DatabaseConnection["db"];

const globalForDatabase = globalThis as typeof globalThis & {
  personalRadarDatabase?: DatabaseConnection;
  personalRadarMigrated?: boolean;
};

export function databaseFilePath(): string {
  const configuredPath = process.env.DATABASE_PATH;
  return configuredPath
    ? path.resolve(/* turbopackIgnore: true */ configuredPath)
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "database.sqlite");
}

export function closeDatabase(): void {
  const connection = globalForDatabase.personalRadarDatabase;
  if (connection) {
    try {
      connection.sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // 损坏恢复流程中 checkpoint 可能失败，仍需关闭句柄。
    }
    if (connection.sqlite.open) connection.sqlite.close();
  }
  delete globalForDatabase.personalRadarDatabase;
  delete globalForDatabase.personalRadarMigrated;
}

export function synchronizeSourceOrigins(connection: DatabaseConnection) {
  const rows = connection.sqlite.prepare("SELECT id, watch_target_id AS watchTargetId, name, url FROM sources").all() as Array<{
    id: string;
    watchTargetId: string;
    name: string;
    url: string;
  }>;
  const findDuplicate = connection.sqlite.prepare("SELECT id FROM sources WHERE watch_target_id = ? AND url = ? AND id <> ? LIMIT 1");
  const updateSource = connection.sqlite.prepare("UPDATE sources SET url = ?, domain = ?, origin = ? WHERE id = ?");
  const deleteSource = connection.sqlite.prepare("DELETE FROM sources WHERE id = ?");
  const ensureStatus = connection.sqlite.prepare(`
    INSERT OR IGNORE INTO site_login_statuses (origin, display_name, status, updated_at)
    VALUES (?, ?, 'unknown', ?)
  `);

  connection.sqlite.transaction(() => {
    for (const row of rows) {
      try {
        const normalized = normalizeSourceUrl(row.url);
        const duplicate = findDuplicate.get(row.watchTargetId, normalized.url, row.id) as { id: string } | undefined;
        if (duplicate) {
          deleteSource.run(row.id);
          continue;
        }
        updateSource.run(normalized.url, normalized.domain, normalized.origin, row.id);
        ensureStatus.run(normalized.origin, row.name || normalized.defaultName, new Date().toISOString());
      } catch {
        // 旧数据若已损坏则保留原记录，避免启动时擅自删除用户数据。
      }
    }
  })();
}

export function getDatabase(): DatabaseConnection {
  if (!globalForDatabase.personalRadarDatabase) {
    globalForDatabase.personalRadarDatabase = openDatabase(databaseFilePath());
  }

  if (!globalForDatabase.personalRadarMigrated) {
    const migrationsFolder = path.join(/* turbopackIgnore: true */ process.cwd(), "drizzle");
    migrate(globalForDatabase.personalRadarDatabase.db, { migrationsFolder });
    synchronizeSourceOrigins(globalForDatabase.personalRadarDatabase);
    globalForDatabase.personalRadarMigrated = true;
  }

  return globalForDatabase.personalRadarDatabase;
}
