import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import { PublicApiError } from "@/lib/api";
import { appTimezone } from "@/lib/business-date";
import { closeDatabase, databaseFilePath, getDatabase } from "@/lib/database";

const BACKUP_FORMAT = "personal-radar-backup";
const BACKUP_VERSION = 1;
export const MAX_BACKUP_UPLOAD_BYTES = 256 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_SINGLE_FILE_BYTES = 128 * 1024 * 1024;
const REQUIRED_TABLES = [
  "watch_targets", "keywords", "sources", "site_login_statuses", "saved_items",
  "daily_reports", "daily_report_items", "profile_suggestions", "__drizzle_migrations"
];

type BackupConfig = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  appTimezone: string;
  includes: { database: true; library: true };
};

type ValidatedArchive = {
  config: BackupConfig;
  database: Buffer;
  libraryFiles: Array<{ relativePath: string; data: Buffer }>;
};

function dataPaths() {
  const database = databaseFilePath();
  const dataDirectory = path.dirname(database);
  return {
    database,
    dataDirectory,
    library: path.join(/* turbopackIgnore: true */ dataDirectory, "library"),
    safetyRoot: path.join(/* turbopackIgnore: true */ dataDirectory, "import-safety")
  };
}

function normalizedArchivePath(value: string): string {
  if (!value || value.includes("\0") || value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value)) {
    throw new PublicApiError("INVALID_BACKUP_PATH", "备份包含不安全的文件路径", 400);
  }
  const segments = value.split("/");
  if (segments.some((segment, index) => segment === ".." || segment === "." || segment === "" && !(index === segments.length - 1 && value.endsWith("/")))) {
    throw new PublicApiError("INVALID_BACKUP_PATH", "备份包含不安全的文件路径", 400);
  }
  return segments.join("/");
}

function collectLibraryFiles(root: string): Array<{ relativePath: string; absolutePath: string; size: number }> {
  if (!fs.existsSync(/* turbopackIgnore: true */ root)) return [];
  const result: Array<{ relativePath: string; absolutePath: string; size: number }> = [];
  const walk = (directory: string, relativeDirectory: string) => {
    for (const entry of fs.readdirSync(/* turbopackIgnore: true */ directory, { withFileTypes: true })) {
      const absolutePath = path.join(/* turbopackIgnore: true */ directory, entry.name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new PublicApiError("UNSAFE_LIBRARY", "资料库包含符号链接，无法安全导出", 400);
      if (entry.isDirectory()) walk(absolutePath, relativePath);
      else if (entry.isFile()) {
        const size = fs.statSync(/* turbopackIgnore: true */ absolutePath).size;
        if (size > MAX_SINGLE_FILE_BYTES) throw new PublicApiError("LIBRARY_FILE_TOO_LARGE", `资料库文件过大：${relativePath}`, 413);
        result.push({ relativePath, absolutePath, size });
      }
      if (result.length > MAX_ARCHIVE_ENTRIES - 3) throw new PublicApiError("TOO_MANY_FILES", "资料库文件数量过多", 413);
    }
  };
  walk(root, "");
  return result;
}

function copyDirectorySafe(source: string, destination: string): void {
  fs.mkdirSync(/* turbopackIgnore: true */ destination, { recursive: true });
  if (!fs.existsSync(/* turbopackIgnore: true */ source)) return;
  for (const entry of fs.readdirSync(/* turbopackIgnore: true */ source, { withFileTypes: true })) {
    const sourcePath = path.join(/* turbopackIgnore: true */ source, entry.name);
    const destinationPath = path.join(/* turbopackIgnore: true */ destination, entry.name);
    if (entry.isSymbolicLink()) throw new PublicApiError("UNSAFE_LIBRARY", "资料库包含符号链接，无法安全处理", 400);
    if (entry.isDirectory()) copyDirectorySafe(sourcePath, destinationPath);
    else if (entry.isFile()) fs.copyFileSync(/* turbopackIgnore: true */ sourcePath, destinationPath);
  }
}

function validateDatabaseFile(filePath: string): void {
  let sqlite: Database.Database | undefined;
  try {
    sqlite = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = sqlite.pragma("integrity_check") as Array<{ integrity_check: string }>;
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") throw new Error("integrity check failed");
    const tableRows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const tables = new Set(tableRows.map((row) => row.name));
    if (REQUIRED_TABLES.some((table) => !tables.has(table))) throw new Error("required tables missing");
    const foreignKeyErrors = sqlite.pragma("foreign_key_check") as unknown[];
    if (foreignKeyErrors.length > 0) throw new Error("foreign key check failed");
  } catch {
    throw new PublicApiError("INVALID_DATABASE", "备份中的 SQLite 数据库无效或版本不兼容", 400);
  } finally {
    sqlite?.close();
  }
}

function parseConfig(data: Buffer): BackupConfig {
  try {
    const value = JSON.parse(data.toString("utf8")) as Partial<BackupConfig>;
    if (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION || value.includes?.database !== true || value.includes?.library !== true || typeof value.createdAt !== "string" || typeof value.appTimezone !== "string") throw new Error("invalid config");
    return value as BackupConfig;
  } catch {
    throw new PublicApiError("INVALID_BACKUP_CONFIG", "备份配置无效或版本不兼容", 400);
  }
}

export function validateBackupArchive(buffer: Buffer): ValidatedArchive {
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BACKUP_UPLOAD_BYTES) throw new PublicApiError("BACKUP_TOO_LARGE", "备份文件为空或超过 256 MB", 413);
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new PublicApiError("INVALID_ZIP", "无法读取这个 ZIP 备份", 400);
  }
  const entries = zip.getEntries();
  if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES) throw new PublicApiError("INVALID_ZIP", "ZIP 条目为空或数量过多", 400);
  const seen = new Set<string>();
  let uncompressedBytes = 0;
  let configBuffer: Buffer | undefined;
  let databaseBuffer: Buffer | undefined;
  const libraryFiles: Array<{ relativePath: string; data: Buffer }> = [];
  for (const entry of entries) {
    const entryPath = normalizedArchivePath(entry.entryName);
    if (seen.has(entryPath)) throw new PublicApiError("DUPLICATE_BACKUP_ENTRY", "备份包含重复文件", 400);
    seen.add(entryPath);
    const allowed = entryPath === "config.json" || entryPath === ".data/database.sqlite" || entryPath === ".data/library/" || entryPath.startsWith(".data/library/");
    if (!allowed) throw new PublicApiError("UNEXPECTED_BACKUP_ENTRY", `备份包含不允许的文件：${entryPath}`, 400);
    if (entry.isDirectory) continue;
    const size = entry.header.size;
    if (size > MAX_SINGLE_FILE_BYTES) throw new PublicApiError("BACKUP_ENTRY_TOO_LARGE", `备份文件过大：${entryPath}`, 413);
    uncompressedBytes += size;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) throw new PublicApiError("BACKUP_TOO_LARGE", "备份解压后超过 512 MB", 413);
    const data = entry.getData();
    if (entryPath === "config.json") configBuffer = data;
    else if (entryPath === ".data/database.sqlite") databaseBuffer = data;
    else libraryFiles.push({ relativePath: entryPath.slice(".data/library/".length), data });
  }
  if (!configBuffer || !databaseBuffer) throw new PublicApiError("INCOMPLETE_BACKUP", "备份缺少 config.json 或 SQLite 数据库", 400);
  return { config: parseConfig(configBuffer), database: databaseBuffer, libraryFiles };
}

export async function createBackupArchive(): Promise<Buffer> {
  const paths = dataPaths();
  const connection = getDatabase();
  fs.mkdirSync(/* turbopackIgnore: true */ paths.dataDirectory, { recursive: true });
  const temporaryDatabase = path.join(/* turbopackIgnore: true */ paths.dataDirectory, `.export-${randomUUID()}.sqlite`);
  try {
    await connection.sqlite.backup(temporaryDatabase);
    validateDatabaseFile(temporaryDatabase);
    const libraryFiles = collectLibraryFiles(paths.library);
    const databaseSize = fs.statSync(/* turbopackIgnore: true */ temporaryDatabase).size;
    if (databaseSize > MAX_SINGLE_FILE_BYTES) throw new PublicApiError("DATABASE_TOO_LARGE", "SQLite 数据库超过 128 MB，暂时无法导出", 413);
    const totalBytes = databaseSize + libraryFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new PublicApiError("BACKUP_TOO_LARGE", "备份内容超过 512 MB", 413);
    const config: BackupConfig = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      appTimezone: appTimezone(),
      includes: { database: true, library: true }
    };
    const zip = new AdmZip();
    zip.addFile("config.json", Buffer.from(JSON.stringify(config, null, 2), "utf8"));
    zip.addLocalFile(temporaryDatabase, ".data", "database.sqlite");
    zip.addFile(".data/library/", Buffer.alloc(0));
    for (const file of libraryFiles) zip.addLocalFile(file.absolutePath, `.data/library/${path.posix.dirname(file.relativePath) === "." ? "" : path.posix.dirname(file.relativePath)}`, path.posix.basename(file.relativePath));
    const archive = zip.toBuffer();
    if (archive.byteLength > MAX_BACKUP_UPLOAD_BYTES) throw new PublicApiError("BACKUP_TOO_LARGE", "生成的 ZIP 超过 256 MB，暂时无法导出", 413);
    return archive;
  } finally {
    if (fs.existsSync(/* turbopackIgnore: true */ temporaryDatabase)) fs.rmSync(/* turbopackIgnore: true */ temporaryDatabase, { force: true });
  }
}

async function createSafetySnapshot(destination: string): Promise<void> {
  const paths = dataPaths();
  fs.mkdirSync(/* turbopackIgnore: true */ destination, { recursive: true });
  await getDatabase().sqlite.backup(path.join(/* turbopackIgnore: true */ destination, "database.sqlite"));
  copyDirectorySafe(paths.library, path.join(/* turbopackIgnore: true */ destination, "library"));
}

function removeDatabaseSidecars(databasePath: string): void {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${databasePath}${suffix}`;
    if (fs.existsSync(/* turbopackIgnore: true */ sidecar)) fs.rmSync(/* turbopackIgnore: true */ sidecar, { force: true });
  }
}

export async function importBackupArchive(buffer: Buffer) {
  const archive = validateBackupArchive(buffer);
  const paths = dataPaths();
  fs.mkdirSync(/* turbopackIgnore: true */ paths.dataDirectory, { recursive: true });
  const operationId = `${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomUUID().slice(0, 8)}`;
  const staging = path.join(/* turbopackIgnore: true */ paths.dataDirectory, `.import-staging-${operationId}`);
  const safety = path.join(/* turbopackIgnore: true */ paths.safetyRoot, operationId);
  const stagingDatabase = path.join(/* turbopackIgnore: true */ staging, "database.sqlite");
  const stagingLibrary = path.join(/* turbopackIgnore: true */ staging, "library");
  let replacementStarted = false;
  try {
    fs.mkdirSync(/* turbopackIgnore: true */ stagingLibrary, { recursive: true });
    fs.writeFileSync(/* turbopackIgnore: true */ stagingDatabase, archive.database, { flag: "wx" });
    for (const file of archive.libraryFiles) {
      const destination = path.resolve(/* turbopackIgnore: true */ stagingLibrary, file.relativePath);
      const libraryRoot = `${path.resolve(/* turbopackIgnore: true */ stagingLibrary)}${path.sep}`;
      if (!destination.startsWith(libraryRoot)) throw new PublicApiError("INVALID_BACKUP_PATH", "备份资料库路径越界", 400);
      fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(destination), { recursive: true });
      fs.writeFileSync(/* turbopackIgnore: true */ destination, file.data, { flag: "wx" });
    }
    validateDatabaseFile(stagingDatabase);
    await createSafetySnapshot(safety);
    replacementStarted = true;
    closeDatabase();
    removeDatabaseSidecars(paths.database);
    fs.copyFileSync(/* turbopackIgnore: true */ stagingDatabase, paths.database);
    if (fs.existsSync(/* turbopackIgnore: true */ paths.library)) fs.rmSync(/* turbopackIgnore: true */ paths.library, { recursive: true, force: true });
    copyDirectorySafe(stagingLibrary, paths.library);
    validateDatabaseFile(paths.database);
    getDatabase();
    return { importedAt: new Date().toISOString(), safetyBackup: safety, config: archive.config };
  } catch (error) {
    if (replacementStarted) {
      try {
        closeDatabase();
        fs.copyFileSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ safety, "database.sqlite"), paths.database);
        removeDatabaseSidecars(paths.database);
        if (fs.existsSync(/* turbopackIgnore: true */ paths.library)) fs.rmSync(/* turbopackIgnore: true */ paths.library, { recursive: true, force: true });
        copyDirectorySafe(path.join(/* turbopackIgnore: true */ safety, "library"), paths.library);
        getDatabase();
      } catch {
        throw new PublicApiError("IMPORT_RESTORE_FAILED", `导入和自动恢复均失败，请从安全副本手动恢复：${safety}`, 500);
      }
    }
    if (error instanceof PublicApiError) throw error;
    throw new PublicApiError("IMPORT_FAILED", replacementStarted ? "导入失败，已恢复导入前数据" : "导入准备失败，当前数据未改变", 500);
  } finally {
    if (fs.existsSync(/* turbopackIgnore: true */ staging)) fs.rmSync(/* turbopackIgnore: true */ staging, { recursive: true, force: true });
  }
}
