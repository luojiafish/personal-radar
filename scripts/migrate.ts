import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase, synchronizeSourceOrigins } from "../lib/database";

const databasePath = path.resolve(process.env.DATABASE_PATH ?? path.join(".data", "database.sqlite"));
const connection = openDatabase(databasePath);

try {
  migrate(connection.db, { migrationsFolder: path.resolve("drizzle") });
  synchronizeSourceOrigins(connection);
  process.stdout.write(`Database migrated: ${databasePath}\n`);
} finally {
  connection.sqlite.close();
}
