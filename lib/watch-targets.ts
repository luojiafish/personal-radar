import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { keywords, siteLoginStatuses, sources, watchTargets, type KeywordRow, type SourceRow, type WatchTargetRow } from "@/drizzle/schema";
import { getDatabase, type DatabaseClient } from "@/lib/database";
import { normalizeKeyword, uniqueKeywords } from "@/lib/keywords";
import { normalizeSourceUrl, uniqueSourceUrls } from "@/lib/source-urls";
import type { CreateKeywordInput, CreateSourceInput, CreateWatchTargetInput, UpdateKeywordInput, UpdateSourceInput, UpdateWatchTargetInput } from "@/lib/validation";

export type WatchTarget = WatchTargetRow & { keywords: KeywordRow[]; sources: SourceRow[] };

function databaseOrDefault(database?: DatabaseClient): DatabaseClient {
  return database ?? getDatabase().db;
}

export function listWatchTargets(database?: DatabaseClient): WatchTarget[] {
  const db = databaseOrDefault(database);
  const targets = db.select().from(watchTargets).orderBy(desc(watchTargets.updatedAt)).all();
  const allKeywords = db.select().from(keywords).orderBy(asc(keywords.createdAt)).all();
  const allSources = db.select().from(sources).orderBy(asc(sources.createdAt)).all();
  return targets.map((target) => ({
    ...target,
    keywords: allKeywords.filter((keyword) => keyword.watchTargetId === target.id),
    sources: allSources.filter((source) => source.watchTargetId === target.id)
  }));
}

export function getWatchTarget(id: string, database?: DatabaseClient): WatchTarget | null {
  const db = databaseOrDefault(database);
  const target = db.select().from(watchTargets).where(eq(watchTargets.id, id)).get();
  if (!target) return null;
  return {
    ...target,
    keywords: db.select().from(keywords).where(eq(keywords.watchTargetId, id)).orderBy(asc(keywords.createdAt)).all(),
    sources: db.select().from(sources).where(eq(sources.watchTargetId, id)).orderBy(asc(sources.createdAt)).all()
  };
}

export function createWatchTarget(input: CreateWatchTargetInput, database?: DatabaseClient): WatchTarget {
  const db = databaseOrDefault(database);
  const id = randomUUID();
  const now = new Date().toISOString();
  const initialKeywords = uniqueKeywords(input.keywords.length > 0 ? input.keywords : [input.name]);
  const initialSources = uniqueSourceUrls(input.websites);

  db.transaction((tx) => {
    tx.insert(watchTargets).values({ id, name: input.name, description: input.description, enabled: true, createdAt: now, updatedAt: now }).run();
    if (initialKeywords.length > 0) {
      tx.insert(keywords).values(initialKeywords.map((keyword) => ({
        id: randomUUID(),
        watchTargetId: id,
        value: keyword.value,
        normalizedValue: keyword.normalizedValue,
        enabled: true,
        origin: "user" as const,
        createdAt: now,
        updatedAt: now
      }))).run();
    }
    if (initialSources.length > 0) {
      tx.insert(sources).values(initialSources.map((source) => ({
        id: randomUUID(),
        watchTargetId: id,
        name: source.defaultName,
        url: source.url,
        domain: source.domain,
        origin: source.origin,
        enabled: true,
        createdAt: now,
        updatedAt: now
      }))).run();
      tx.insert(siteLoginStatuses).values(initialSources.map((source) => ({
        origin: source.origin,
        displayName: source.defaultName,
        status: "unknown" as const,
        updatedAt: now
      }))).onConflictDoNothing().run();
    }
  });

  return getWatchTarget(id, db)!;
}

export function updateWatchTarget(id: string, input: UpdateWatchTargetInput, database?: DatabaseClient): WatchTarget | null {
  const db = databaseOrDefault(database);
  const existing = getWatchTarget(id, db);
  if (!existing) return null;
  db.update(watchTargets).set({ ...input, updatedAt: new Date().toISOString() }).where(eq(watchTargets.id, id)).run();
  return getWatchTarget(id, db);
}

export function addKeyword(watchTargetId: string, input: CreateKeywordInput, database?: DatabaseClient): KeywordRow | null {
  const db = databaseOrDefault(database);
  const target = db.select({ id: watchTargets.id }).from(watchTargets).where(eq(watchTargets.id, watchTargetId)).get();
  if (!target) return null;
  const normalizedValue = normalizeKeyword(input.value);
  const existing = db.select().from(keywords).where(and(eq(keywords.watchTargetId, watchTargetId), eq(keywords.normalizedValue, normalizedValue))).get();
  if (existing) return existing;
  const now = new Date().toISOString();
  const keyword = { id: randomUUID(), watchTargetId, value: input.value.trim(), normalizedValue, enabled: true, origin: "user" as const, createdAt: now, updatedAt: now };
  db.insert(keywords).values(keyword).run();
  db.update(watchTargets).set({ updatedAt: now }).where(eq(watchTargets.id, watchTargetId)).run();
  return keyword;
}

export function updateKeyword(id: string, input: UpdateKeywordInput, database?: DatabaseClient): KeywordRow | null {
  const db = databaseOrDefault(database);
  const existing = db.select().from(keywords).where(eq(keywords.id, id)).get();
  if (!existing) return null;
  const now = new Date().toISOString();
  const patch: { value?: string; normalizedValue?: string; enabled?: boolean; updatedAt: string } = { updatedAt: now };
  if (input.value !== undefined) {
    patch.value = input.value.trim();
    patch.normalizedValue = normalizeKeyword(input.value);
  }
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  db.update(keywords).set(patch).where(eq(keywords.id, id)).run();
  db.update(watchTargets).set({ updatedAt: now }).where(eq(watchTargets.id, existing.watchTargetId)).run();
  return db.select().from(keywords).where(eq(keywords.id, id)).get() ?? null;
}

export function deleteKeyword(id: string, database?: DatabaseClient): boolean {
  const db = databaseOrDefault(database);
  const existing = db.select().from(keywords).where(eq(keywords.id, id)).get();
  if (!existing) return false;
  db.transaction((tx) => {
    tx.delete(keywords).where(eq(keywords.id, id)).run();
    tx.update(watchTargets).set({ updatedAt: new Date().toISOString() }).where(eq(watchTargets.id, existing.watchTargetId)).run();
  });
  return true;
}

export function addSource(watchTargetId: string, input: CreateSourceInput, database?: DatabaseClient): SourceRow | null {
  const db = databaseOrDefault(database);
  const target = db.select({ id: watchTargets.id }).from(watchTargets).where(eq(watchTargets.id, watchTargetId)).get();
  if (!target) return null;
  const normalized = normalizeSourceUrl(input.url);
  const existing = db.select().from(sources).where(and(eq(sources.watchTargetId, watchTargetId), eq(sources.url, normalized.url))).get();
  if (existing) return existing;
  const now = new Date().toISOString();
  const source = {
    id: randomUUID(),
    watchTargetId,
    name: input.name || normalized.defaultName,
    url: normalized.url,
    domain: normalized.domain,
    origin: normalized.origin,
    enabled: true,
    createdAt: now,
    updatedAt: now
  };
  db.transaction((tx) => {
    tx.insert(sources).values(source).run();
    tx.insert(siteLoginStatuses).values({
      origin: normalized.origin,
      displayName: normalized.defaultName,
      status: "unknown",
      updatedAt: now
    }).onConflictDoNothing().run();
  });
  db.update(watchTargets).set({ updatedAt: now }).where(eq(watchTargets.id, watchTargetId)).run();
  return source;
}

export function updateSource(id: string, input: UpdateSourceInput, database?: DatabaseClient): SourceRow | null {
  const db = databaseOrDefault(database);
  const existing = db.select().from(sources).where(eq(sources.id, id)).get();
  if (!existing) return null;
  const now = new Date().toISOString();
  db.update(sources).set({ ...input, updatedAt: now }).where(eq(sources.id, id)).run();
  db.update(watchTargets).set({ updatedAt: now }).where(eq(watchTargets.id, existing.watchTargetId)).run();
  return db.select().from(sources).where(eq(sources.id, id)).get() ?? null;
}

export function deleteSource(id: string, database?: DatabaseClient): boolean {
  const db = databaseOrDefault(database);
  const existing = db.select().from(sources).where(eq(sources.id, id)).get();
  if (!existing) return false;
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.delete(sources).where(eq(sources.id, id)).run();
    const remainingOrigin = tx.select({ id: sources.id }).from(sources).where(eq(sources.origin, existing.origin)).get();
    if (!remainingOrigin) tx.delete(siteLoginStatuses).where(eq(siteLoginStatuses.origin, existing.origin)).run();
    tx.update(watchTargets).set({ updatedAt: now }).where(eq(watchTargets.id, existing.watchTargetId)).run();
  });
  return true;
}
