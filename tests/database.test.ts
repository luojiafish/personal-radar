import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "@/lib/database";
import { createSavedItem, listSavedItems, updateSavedItemSummary } from "@/lib/saved-items";
import { listSiteLoginStatuses, updateSiteLoginStatus } from "@/lib/site-login-status";
import { addSource, createWatchTarget, deleteKeyword, deleteSource, listWatchTargets, updateKeyword, updateSource, updateWatchTarget } from "@/lib/watch-targets";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("watch target persistence", () => {
  it("migrates, persists a target, deduplicates initial keywords and preserves disabled rows", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-radar-"));
    temporaryDirectories.push(directory);
    const connection = openDatabase(path.join(directory, "database.sqlite"));
    migrate(connection.db, { migrationsFolder: path.resolve("drizzle") });

    const created = createWatchTarget({
      name: "人工智能",
      description: "本地测试",
      keywords: ["AI", "ａｉ", "大模型"],
      websites: ["example.com", "https://example.com/"]
    }, connection.db);
    expect(created.keywords).toHaveLength(2);
    expect(created.sources).toHaveLength(1);
    expect(updateWatchTarget(created.id, { description: "更新后的本地测试" }, connection.db)?.description).toBe("更新后的本地测试");
    const firstKeyword = created.keywords[0]!;
    const firstSource = created.sources[0]!;
    updateKeyword(firstKeyword.id, { enabled: false }, connection.db);
    const renamedKeyword = created.keywords[1]!;
    expect(updateKeyword(renamedKeyword.id, { value: "基础模型" }, connection.db)?.value).toBe("基础模型");
    expect(deleteKeyword(renamedKeyword.id, connection.db)).toBe(true);
    updateSource(firstSource.id, { enabled: false }, connection.db);
    expect(addSource(created.id, { url: "https://example.com" }, connection.db)?.id).toBe(firstSource.id);
    const removableSource = addSource(created.id, { url: "https://remove.example.com" }, connection.db)!;
    expect(deleteSource(removableSource.id, connection.db)).toBe(true);
    expect(deleteSource(removableSource.id, connection.db)).toBe(false);
    connection.sqlite.close();

    const reopened = openDatabase(path.join(directory, "database.sqlite"));
    const targets = listWatchTargets(reopened.db);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.keywords).toHaveLength(1);
    expect(targets[0]?.keywords.find((keyword) => keyword.id === firstKeyword.id)?.enabled).toBe(false);
    expect(targets[0]?.sources).toHaveLength(1);
    expect(targets[0]?.sources[0]?.enabled).toBe(false);
    reopened.sqlite.close();
  });

  it("persists saved items and site-level login verification", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-radar-"));
    temporaryDirectories.push(directory);
    const connection = openDatabase(path.join(directory, "database.sqlite"));
    migrate(connection.db, { migrationsFolder: path.resolve("drizzle") });
    const target = createWatchTarget({
      name: "交通研究",
      description: "",
      keywords: [],
      websites: ["https://community.example.com/posts/123?view=full"]
    }, connection.db);

    expect(target.sources[0]?.url).toBe("https://community.example.com");
    expect(listSiteLoginStatuses(connection.db)[0]?.effectiveStatus).toBe("unknown");
    const status = updateSiteLoginStatus({
      origin: "https://community.example.com/posts/999",
      status: "authenticated",
      method: "extension_user",
      detectorVersion: "test-v1"
    }, connection.db);
    expect(status?.origin).toBe("https://community.example.com");
    expect(status?.effectiveStatus).toBe("authenticated");

    const saved = createSavedItem({
      watchTargetId: target.id,
      title: "测试文章",
      url: "https://example.com/article#section",
      contentExcerpt: "正文摘录",
      selectedText: "用户选文",
      aiSummary: "AI 摘要"
    }, connection.db);
    expect(saved?.url).toBe("https://example.com/article#section");
    expect(saved?.selectedText).toBe("用户选文");
    expect(updateSavedItemSummary(saved!.id, { aiSummary: "用户确认后的摘要" }, connection.db)?.aiSummary).toBe("用户确认后的摘要");
    expect(listSavedItems(connection.db)).toHaveLength(1);
    connection.sqlite.close();
  });
});
