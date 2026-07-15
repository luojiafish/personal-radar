import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { businessDateFor, utcRangeForBusinessDate } from "@/lib/business-date";
import { openDatabase } from "@/lib/database";
import { getDailyReport, listDailyReportCandidates, listDailyReports, saveDailyReport } from "@/lib/daily-reports";
import { createSavedItem } from "@/lib/saved-items";
import { createWatchTarget } from "@/lib/watch-targets";
import { dailyReportSelectionSchema } from "@/lib/validation";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("daily reports", () => {
  it("uses the configured business timezone for daily UTC boundaries", () => {
    expect(utcRangeForBusinessDate("2026-07-15", "Asia/Shanghai")).toEqual({
      start: "2026-07-14T16:00:00.000Z",
      end: "2026-07-15T16:00:00.000Z"
    });
    expect(() => utcRangeForBusinessDate("2026-02-30", "Asia/Shanghai")).toThrow("日期无效");
    const id = "8b77970e-6f67-4b49-9e25-4a5cc9cbf1b9";
    expect(() => dailyReportSelectionSchema.parse({ watchTargetId: id, reportDate: "2026-07-15", itemIds: [id, id] })).toThrow("不能重复");
  });

  it("builds candidates from the selected day and updates one confirmed report per target and date", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-radar-reports-"));
    temporaryDirectories.push(directory);
    const connection = openDatabase(path.join(directory, "database.sqlite"));
    migrate(connection.db, { migrationsFolder: path.resolve("drizzle") });
    const target = createWatchTarget({ name: "本地情报", description: "", keywords: ["测试"], websites: [] }, connection.db);
    const saved = createSavedItem({
      watchTargetId: target.id,
      title: "今日采集内容",
      url: "https://example.com/report-source",
      contentExcerpt: "这是用于今日情报数据库测试的虚构正文，内容足够长并且不包含任何真实私人信息。",
      selectedText: "用户主动选择的虚构文字",
      aiSummary: ""
    }, connection.db)!;
    const reportDate = businessDateFor(new Date());
    expect(listDailyReportCandidates(target.id, reportDate, connection.db).map((item) => item.id)).toEqual([saved.id]);

    const first = saveDailyReport({
      watchTargetId: target.id,
      reportDate,
      itemIds: [saved.id],
      title: "本地情报 · 今日日报",
      summary: "这是经过用户确认的第一版今日情报摘要，全部内容均来自虚构测试数据。"
    }, connection.db);
    expect(first.items).toHaveLength(1);
    expect(getDailyReport(first.id, connection.db)?.items[0]?.url).toContain("report-source");

    const updated = saveDailyReport({
      watchTargetId: target.id,
      reportDate,
      itemIds: [saved.id],
      title: "本地情报 · 更新日报",
      summary: "这是同一关注对象和日期更新后的确认摘要，不会额外创建重复日报记录。"
    }, connection.db);
    expect(updated.id).toBe(first.id);
    expect(updated.title).toContain("更新");
    expect(listDailyReports(connection.db)).toHaveLength(1);
    connection.sqlite.close();
  });

  it("rejects report items from another target", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-radar-reports-"));
    temporaryDirectories.push(directory);
    const connection = openDatabase(path.join(directory, "database.sqlite"));
    migrate(connection.db, { migrationsFolder: path.resolve("drizzle") });
    const firstTarget = createWatchTarget({ name: "对象一", description: "", keywords: [], websites: [] }, connection.db);
    const secondTarget = createWatchTarget({ name: "对象二", description: "", keywords: [], websites: [] }, connection.db);
    const otherItem = createSavedItem({ watchTargetId: secondTarget.id, title: "其他对象内容", url: "https://example.com/other", contentExcerpt: "虚构正文", selectedText: "", aiSummary: "" }, connection.db)!;
    expect(() => saveDailyReport({
      watchTargetId: firstTarget.id,
      reportDate: businessDateFor(new Date()),
      itemIds: [otherItem.id],
      title: "错误日报",
      summary: "这份日报不应该保存，因为条目属于另一个完全不同的关注对象。"
    }, connection.db)).toThrow("不属于该关注对象");
    connection.sqlite.close();
  });
});
