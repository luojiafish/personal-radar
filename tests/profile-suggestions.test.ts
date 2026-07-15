import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { businessDateFor } from "@/lib/business-date";
import { openDatabase } from "@/lib/database";
import { saveDailyReport } from "@/lib/daily-reports";
import { confirmProfileSuggestion, getProfileContext, listConfirmedProfileSuggestions, listProfileEvidence, sanitizeProfileSuggestionDrafts, updateProfileContext } from "@/lib/profile-suggestions";
import { createSavedItem } from "@/lib/saved-items";
import { createWatchTarget } from "@/lib/watch-targets";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("profile suggestions", () => {
  it("keeps only allowed non-sensitive suggestion kinds and deduplicates values", () => {
    const safe = sanitizeProfileSuggestionDrafts([
      { kind: "current_topic", value: "多模态模型", rationale: "多条确认内容都围绕视觉语言模型", goalRelation: "支持用户理解模型能力的目标" },
      { kind: "current_topic", value: "多模态模型", rationale: "重复建议", goalRelation: "重复" },
      { kind: "keyword", value: "RAG 评测", rationale: "确认内容多次出现检索增强评测", goalRelation: "帮助持续积累评测方法" },
      { kind: "current_topic", value: "健康状况", rationale: "不允许推断健康信息", goalRelation: "敏感信息" },
      { kind: "personality", value: "谨慎", rationale: "不允许的类型", goalRelation: "无效" },
      { kind: "keyword", value: "", rationale: "无效", goalRelation: "无效" }
    ]);
    expect(safe).toEqual([
      { kind: "current_topic", value: "多模态模型", rationale: "多条确认内容都围绕视觉语言模型", goalRelation: "支持用户理解模型能力的目标" },
      { kind: "keyword", value: "RAG 评测", rationale: "确认内容多次出现检索增强评测", goalRelation: "帮助持续积累评测方法" }
    ]);
  });

  it("uses only items confirmed in daily reports and persists suggestions only after confirmation", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-radar-profile-"));
    temporaryDirectories.push(directory);
    const connection = openDatabase(path.join(directory, "database.sqlite"));
    migrate(connection.db, { migrationsFolder: path.resolve("drizzle") });
    const target = createWatchTarget({ name: "模型研究", description: "", keywords: ["多模态"], websites: [] }, connection.db);
    expect(getProfileContext(connection.db).selfAssessment).toBe("");
    const context = updateProfileContext({ selfAssessment: "我正在系统整理模型评测方法", goals: "建立可复用的技术研究框架" }, connection.db);
    expect(context.goals).toBe("建立可复用的技术研究框架");
    const confirmedOne = createSavedItem({ watchTargetId: target.id, title: "视觉语言模型评测", url: "https://example.com/vlm", contentExcerpt: "虚构的视觉语言模型评测内容。", selectedText: "", aiSummary: "视觉语言模型在公开基准上的评测结果。" }, connection.db)!;
    const confirmedTwo = createSavedItem({ watchTargetId: target.id, title: "检索增强生成", url: "https://example.com/rag", contentExcerpt: "虚构的检索增强生成内容。", selectedText: "", aiSummary: "检索增强生成的质量评测方法。" }, connection.db)!;
    createSavedItem({ watchTargetId: target.id, title: "未进入日报", url: "https://example.com/unconfirmed", contentExcerpt: "这条内容未被用户确认进入日报。", selectedText: "", aiSummary: "" }, connection.db);
    const reportDate = businessDateFor(new Date());
    saveDailyReport({
      watchTargetId: target.id,
      reportDate,
      itemIds: [confirmedOne.id, confirmedTwo.id],
      title: "模型研究今日情报",
      summary: "这是包含两条虚构确认内容的日报，用于验证画像证据边界。"
    }, connection.db);

    const evidence = listProfileEvidence(connection.db);
    expect(evidence).toHaveLength(2);
    expect(evidence.map((item) => item.title)).not.toContain("未进入日报");
    expect(listConfirmedProfileSuggestions(connection.db)).toHaveLength(0);

    const id = randomUUID();
    const confirmed = confirmProfileSuggestion(id, {
      kind: "keyword",
      value: "多模态评测",
      rationale: "两条已确认内容涉及模型与评测方法",
      goalRelation: "帮助建立可复用的技术研究框架",
      evidenceCount: evidence.length,
      evidenceStartDate: reportDate,
      evidenceEndDate: reportDate
    }, connection.db);
    expect(confirmed.id).toBe(id);
    expect(listConfirmedProfileSuggestions(connection.db)).toHaveLength(1);

    const duplicate = confirmProfileSuggestion(randomUUID(), {
      kind: "keyword",
      value: "多模态评测",
      rationale: "相同建议不应重复保存",
      goalRelation: "仍然服务同一研究框架目标",
      evidenceCount: evidence.length,
      evidenceStartDate: reportDate,
      evidenceEndDate: reportDate
    }, connection.db);
    expect(duplicate.id).toBe(id);
    expect(() => confirmProfileSuggestion(randomUUID(), {
      kind: "current_topic",
      value: "健康状况",
      rationale: "不允许保存敏感属性",
      goalRelation: "与目标无关",
      evidenceCount: evidence.length,
      evidenceStartDate: reportDate,
      evidenceEndDate: reportDate
    }, connection.db)).toThrow("敏感属性");
    connection.sqlite.close();
  });
});
