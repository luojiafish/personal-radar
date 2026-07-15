import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { dailyReportItems, dailyReports, profileSuggestions, savedItems, watchTargets, type ProfileSuggestionRow } from "@/drizzle/schema";
import { generateProfileSuggestionDraftsWithAi } from "@/lib/ai";
import { PublicApiError } from "@/lib/api";
import { getDatabase, type DatabaseClient } from "@/lib/database";
import { profileSuggestionKinds, type GeneratedProfileSuggestion, type ProfileEvidence, type ProfileSuggestionKind } from "@/lib/profile-types";
import type { ConfirmProfileSuggestionInput } from "@/lib/validation";

const SENSITIVE_PROFILE_PATTERN = /(?:性格|人格|生活状态|健康|疾病|病史|心理|政治|党派|宗教|信仰|性取向|性别|种族|民族|婚姻|家庭状况|收入|财务状况|personality|health|medical|politic|religion|sexual\s*orientation|race|ethnicity|marital|income|financial\s*status)/iu;
const KIND_LIMITS: Record<ProfileSuggestionKind, number> = { current_topic: 3, interest_change: 2, work_learning_direction: 2, keyword: 5 };

function databaseOrDefault(database?: DatabaseClient): DatabaseClient {
  return database ?? getDatabase().db;
}

function normalizeValue(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

export function sanitizeProfileSuggestionDrafts(input: unknown[]): GeneratedProfileSuggestion[] {
  const result: GeneratedProfileSuggestion[] = [];
  const seen = new Set<string>();
  const counts = new Map<ProfileSuggestionKind, number>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.kind !== "string" || !profileSuggestionKinds.includes(candidate.kind as ProfileSuggestionKind)) continue;
    if (typeof candidate.value !== "string" || typeof candidate.rationale !== "string") continue;
    const kind = candidate.kind as ProfileSuggestionKind;
    const value = normalizeValue(candidate.value).slice(0, 120);
    const rationale = normalizeValue(candidate.rationale).slice(0, 400);
    if (value.length < 2 || rationale.length < 2 || SENSITIVE_PROFILE_PATTERN.test(`${value}\n${rationale}`)) continue;
    if ((counts.get(kind) ?? 0) >= KIND_LIMITS[kind]) continue;
    const key = `${kind}:${value.toLocaleLowerCase("zh-CN")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    result.push({ kind, value, rationale });
    if (result.length >= 12) break;
  }
  return result;
}

export function listProfileEvidence(database?: DatabaseClient): ProfileEvidence[] {
  const db = databaseOrDefault(database);
  const rows = db.select({
    reportDate: dailyReports.reportDate,
    targetName: watchTargets.name,
    title: savedItems.title,
    url: savedItems.url,
    aiSummary: savedItems.aiSummary,
    selectedText: savedItems.selectedText,
    contentExcerpt: savedItems.contentExcerpt
  }).from(dailyReportItems)
    .innerJoin(dailyReports, eq(dailyReportItems.dailyReportId, dailyReports.id))
    .innerJoin(savedItems, eq(dailyReportItems.savedItemId, savedItems.id))
    .innerJoin(watchTargets, eq(savedItems.watchTargetId, watchTargets.id))
    .orderBy(desc(dailyReports.reportDate), desc(dailyReports.updatedAt))
    .limit(100).all();
  return rows.map((row) => ({
    reportDate: row.reportDate,
    targetName: row.targetName,
    title: row.title,
    url: row.url,
    content: row.aiSummary || row.selectedText || row.contentExcerpt
  }));
}

export async function generateProfileSuggestions(database?: DatabaseClient) {
  const evidence = listProfileEvidence(database);
  if (evidence.length < 2) throw new PublicApiError("NOT_ENOUGH_EVIDENCE", "至少需要两条已确认进入日报的情报，才能生成画像建议", 422);
  const suggestions = sanitizeProfileSuggestionDrafts(await generateProfileSuggestionDraftsWithAi(evidence));
  if (suggestions.length === 0) throw new PublicApiError("NO_SAFE_SUGGESTIONS", "AI 没有返回可安全确认的建议，请积累更多非敏感情报后重试", 422);
  const dates = evidence.map((item) => item.reportDate).sort();
  return {
    evidenceCount: evidence.length,
    evidenceStartDate: dates[0]!,
    evidenceEndDate: dates.at(-1)!,
    suggestions: suggestions.map((suggestion) => ({ id: randomUUID(), ...suggestion }))
  };
}

export function confirmProfileSuggestion(id: string, input: ConfirmProfileSuggestionInput, database?: DatabaseClient): ProfileSuggestionRow {
  const db = databaseOrDefault(database);
  const existingById = db.select().from(profileSuggestions).where(eq(profileSuggestions.id, id)).get();
  if (existingById) return existingById;
  if (input.evidenceStartDate > input.evidenceEndDate) throw new PublicApiError("INVALID_EVIDENCE_RANGE", "画像建议的证据日期范围无效", 400);
  const safe = sanitizeProfileSuggestionDrafts([{ kind: input.kind, value: input.value, rationale: input.rationale }])[0];
  if (!safe) throw new PublicApiError("SENSITIVE_SUGGESTION", "该建议包含不允许保存的敏感属性或格式无效", 400);
  const normalizedValue = safe.value.toLocaleLowerCase("zh-CN");
  const duplicate = db.select().from(profileSuggestions).where(and(eq(profileSuggestions.kind, safe.kind), eq(profileSuggestions.normalizedValue, normalizedValue))).get();
  if (duplicate) return duplicate;
  const now = new Date().toISOString();
  const row: ProfileSuggestionRow = {
    id,
    kind: safe.kind,
    value: safe.value,
    normalizedValue,
    rationale: safe.rationale,
    evidenceCount: input.evidenceCount,
    evidenceStartDate: input.evidenceStartDate,
    evidenceEndDate: input.evidenceEndDate,
    confirmedAt: now,
    createdAt: now
  };
  db.insert(profileSuggestions).values(row).run();
  return row;
}

export function listConfirmedProfileSuggestions(database?: DatabaseClient): ProfileSuggestionRow[] {
  return databaseOrDefault(database).select().from(profileSuggestions).orderBy(desc(profileSuggestions.confirmedAt)).limit(50).all();
}
