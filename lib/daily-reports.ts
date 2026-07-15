import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { dailyReportItems, dailyReports, keywords, savedItems, watchTargets, type DailyReportRow } from "@/drizzle/schema";
import { PublicApiError } from "@/lib/api";
import { utcRangeForBusinessDate } from "@/lib/business-date";
import { getDatabase, type DatabaseClient } from "@/lib/database";
import { generateDailyReport } from "@/lib/ai";
import type { CreateDailyReportInput, DailyReportSelectionInput } from "@/lib/validation";

function databaseOrDefault(database?: DatabaseClient): DatabaseClient {
  return database ?? getDatabase().db;
}

export type DailyReportCandidate = {
  id: string;
  watchTargetId: string;
  title: string;
  url: string;
  sourceDomain: string;
  contentExcerpt: string;
  selectedText: string;
  aiSummary: string;
  createdAt: string;
};

export type DailyReport = DailyReportRow & {
  watchTargetName: string;
  items: DailyReportCandidate[];
};

export function listDailyReportCandidates(watchTargetId: string, reportDate: string, database?: DatabaseClient): DailyReportCandidate[] {
  const db = databaseOrDefault(database);
  const target = db.select({ id: watchTargets.id }).from(watchTargets).where(eq(watchTargets.id, watchTargetId)).get();
  if (!target) throw new PublicApiError("NOT_FOUND", "关注对象不存在", 404);
  const range = utcRangeForBusinessDate(reportDate);
  return db.select({
    id: savedItems.id,
    watchTargetId: savedItems.watchTargetId,
    title: savedItems.title,
    url: savedItems.url,
    sourceDomain: savedItems.sourceDomain,
    contentExcerpt: savedItems.contentExcerpt,
    selectedText: savedItems.selectedText,
    aiSummary: savedItems.aiSummary,
    createdAt: savedItems.createdAt
  }).from(savedItems).where(and(
    eq(savedItems.watchTargetId, watchTargetId),
    gte(savedItems.createdAt, range.start),
    lt(savedItems.createdAt, range.end)
  )).orderBy(desc(savedItems.createdAt)).limit(20).all();
}

function selectedCandidates(input: DailyReportSelectionInput, database?: DatabaseClient): DailyReportCandidate[] {
  const candidates = listDailyReportCandidates(input.watchTargetId, input.reportDate, database);
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = input.itemIds.map((id) => byId.get(id)).filter((item): item is DailyReportCandidate => Boolean(item));
  if (selected.length !== input.itemIds.length) throw new PublicApiError("INVALID_REPORT_ITEMS", "所选情报不属于该关注对象或不在指定日期内", 400);
  return selected;
}

export async function generateDailyReportDraft(input: DailyReportSelectionInput, database?: DatabaseClient) {
  const db = databaseOrDefault(database);
  const items = selectedCandidates(input, db);
  const target = db.select({ id: watchTargets.id, name: watchTargets.name }).from(watchTargets).where(eq(watchTargets.id, input.watchTargetId)).get();
  if (!target) throw new PublicApiError("NOT_FOUND", "关注对象不存在", 404);
  const activeKeywords = db.select({ value: keywords.value }).from(keywords).where(and(eq(keywords.watchTargetId, input.watchTargetId), eq(keywords.enabled, true))).orderBy(asc(keywords.createdAt)).all();
  const summary = await generateDailyReport({
    targetName: target.name,
    reportDate: input.reportDate,
    keywords: activeKeywords.map((keyword) => keyword.value),
    items
  });
  return {
    title: `${target.name} · ${input.reportDate} 今日情报`,
    reportDate: input.reportDate,
    watchTargetId: target.id,
    itemIds: items.map((item) => item.id),
    summary
  };
}

export function saveDailyReport(input: CreateDailyReportInput, database?: DatabaseClient): DailyReport {
  const db = databaseOrDefault(database);
  const items = selectedCandidates(input, db);
  const target = db.select({ id: watchTargets.id }).from(watchTargets).where(eq(watchTargets.id, input.watchTargetId)).get();
  if (!target) throw new PublicApiError("NOT_FOUND", "关注对象不存在", 404);
  const existing = db.select({ id: dailyReports.id, createdAt: dailyReports.createdAt }).from(dailyReports).where(and(eq(dailyReports.watchTargetId, input.watchTargetId), eq(dailyReports.reportDate, input.reportDate))).get();
  const now = new Date().toISOString();
  const reportId = existing?.id ?? randomUUID();

  db.transaction((tx) => {
    if (existing) {
      tx.update(dailyReports).set({ title: input.title, summary: input.summary, updatedAt: now }).where(eq(dailyReports.id, reportId)).run();
      tx.delete(dailyReportItems).where(eq(dailyReportItems.dailyReportId, reportId)).run();
    } else {
      tx.insert(dailyReports).values({ id: reportId, watchTargetId: input.watchTargetId, reportDate: input.reportDate, title: input.title, summary: input.summary, createdAt: now, updatedAt: now }).run();
    }
    tx.insert(dailyReportItems).values(items.map((item, position) => ({
      id: randomUUID(),
      dailyReportId: reportId,
      savedItemId: item.id,
      position,
      createdAt: now
    }))).run();
  });

  return getDailyReport(reportId, db)!;
}

export function getDailyReport(id: string, database?: DatabaseClient): DailyReport | null {
  const db = databaseOrDefault(database);
  const report = db.select({
    id: dailyReports.id,
    watchTargetId: dailyReports.watchTargetId,
    watchTargetName: watchTargets.name,
    reportDate: dailyReports.reportDate,
    title: dailyReports.title,
    summary: dailyReports.summary,
    createdAt: dailyReports.createdAt,
    updatedAt: dailyReports.updatedAt
  }).from(dailyReports).innerJoin(watchTargets, eq(dailyReports.watchTargetId, watchTargets.id)).where(eq(dailyReports.id, id)).get();
  if (!report) return null;
  const items = db.select({
    id: savedItems.id,
    watchTargetId: savedItems.watchTargetId,
    title: savedItems.title,
    url: savedItems.url,
    sourceDomain: savedItems.sourceDomain,
    contentExcerpt: savedItems.contentExcerpt,
    selectedText: savedItems.selectedText,
    aiSummary: savedItems.aiSummary,
    createdAt: savedItems.createdAt
  }).from(dailyReportItems).innerJoin(savedItems, eq(dailyReportItems.savedItemId, savedItems.id)).where(eq(dailyReportItems.dailyReportId, id)).orderBy(asc(dailyReportItems.position)).all();
  return { ...report, items };
}

export function listDailyReports(database?: DatabaseClient): DailyReport[] {
  const db = databaseOrDefault(database);
  const rows = db.select({ id: dailyReports.id }).from(dailyReports).orderBy(desc(dailyReports.reportDate), desc(dailyReports.updatedAt)).limit(12).all();
  return rows.map((row) => getDailyReport(row.id, db)).filter((report): report is DailyReport => Boolean(report));
}
