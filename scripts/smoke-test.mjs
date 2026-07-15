import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = fs.readFileSync(new URL("../drizzle/0000_initial.sql", import.meta.url), "utf8");
const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
for (const statement of migration.split("--> statement-breakpoint")) {
  if (statement.trim()) database.exec(statement);
}

database.prepare("INSERT INTO watch_targets (id, name) VALUES (?, ?)").run("target-1", "人工智能");
database.prepare("INSERT INTO keywords (id, watch_target_id, value, normalized_value) VALUES (?, ?, ?, ?)").run("keyword-1", "target-1", "AI", "ai");
assert.throws(() => database.prepare("INSERT INTO keywords (id, watch_target_id, value, normalized_value) VALUES (?, ?, ?, ?)").run("keyword-2", "target-1", "ａｉ", "ai"));
database.prepare("UPDATE keywords SET enabled = 0 WHERE id = ?").run("keyword-1");
assert.equal(database.prepare("SELECT enabled FROM keywords WHERE id = ?").get("keyword-1").enabled, 0);
database.close();
process.stdout.write("SQLite migration smoke test passed.\n");
