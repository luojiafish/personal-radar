import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupArchive, importBackupArchive, validateBackupArchive } from "@/lib/backup";
import { closeDatabase, getDatabase } from "@/lib/database";
import { createWatchTarget, listWatchTargets } from "@/lib/watch-targets";

const temporaryDirectories: string[] = [];
const originalDatabasePath = process.env.DATABASE_PATH;

afterEach(() => {
  closeDatabase();
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function configureTemporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-radar-backup-"));
  temporaryDirectories.push(directory);
  closeDatabase();
  process.env.DATABASE_PATH = path.join(directory, "database.sqlite");
  return { directory, connection: getDatabase() };
}

describe("backup export and import", () => {
  it("exports only the allowed structure and restores database and library through a safety snapshot", async () => {
    const { directory, connection } = configureTemporaryDatabase();
    createWatchTarget({ name: "备份前对象", description: "虚构数据", keywords: ["备份"], websites: [] }, connection.db);
    const library = path.join(directory, "library", "notes");
    fs.mkdirSync(library, { recursive: true });
    fs.writeFileSync(path.join(library, "example.txt"), "fictional library content", "utf8");
    fs.writeFileSync(path.join(directory, ".env.local"), "AI_API_KEY=must-not-export", "utf8");

    const archive = await createBackupArchive();
    const zip = new AdmZip(archive);
    const names = zip.getEntries().map((entry) => entry.entryName).sort();
    expect(names).toContain("config.json");
    expect(names).toContain(".data/database.sqlite");
    expect(names).toContain(".data/library/notes/example.txt");
    expect(names.some((name) => name.includes(".env") || name.toLowerCase().includes("key"))).toBe(false);
    const config = zip.readAsText("config.json");
    expect(config).toContain('"format": "personal-radar-backup"');
    expect(config.toLowerCase()).not.toContain("api_key");

    createWatchTarget({ name: "导出后新增对象", description: "应被恢复覆盖", keywords: [], websites: [] }, connection.db);
    fs.writeFileSync(path.join(library, "example.txt"), "changed after export", "utf8");
    const result = await importBackupArchive(archive);
    expect(result.safetyBackup).toContain("import-safety");
    expect(fs.existsSync(path.join(result.safetyBackup, "database.sqlite"))).toBe(true);
    expect(listWatchTargets()).toHaveLength(1);
    expect(listWatchTargets()[0]?.name).toBe("备份前对象");
    expect(fs.readFileSync(path.join(library, "example.txt"), "utf8")).toBe("fictional library content");
  });

  it("rejects unexpected files and invalid SQLite before replacing current data", async () => {
    const { directory, connection } = configureTemporaryDatabase();
    createWatchTarget({ name: "当前数据", description: "", keywords: [], websites: [] }, connection.db);
    const validArchive = await createBackupArchive();
    const malicious = new AdmZip(validArchive);
    malicious.addFile(".env.local", Buffer.from("SECRET=forbidden"));
    expect(() => validateBackupArchive(malicious.toBuffer())).toThrow("不允许的文件");

    const invalidDatabase = new AdmZip();
    invalidDatabase.addFile("config.json", Buffer.from(JSON.stringify({ format: "personal-radar-backup", version: 1, createdAt: new Date().toISOString(), appTimezone: "Asia/Shanghai", includes: { database: true, library: true } })));
    invalidDatabase.addFile(".data/database.sqlite", Buffer.from("not a sqlite database"));
    invalidDatabase.addFile(".data/library/", Buffer.alloc(0));
    await expect(importBackupArchive(invalidDatabase.toBuffer())).rejects.toThrow("SQLite 数据库无效");
    expect(fs.readdirSync(directory).some((name) => name.startsWith(".import-staging-"))).toBe(false);
    expect(listWatchTargets()).toHaveLength(1);
    expect(listWatchTargets()[0]?.name).toBe("当前数据");
  });
});
