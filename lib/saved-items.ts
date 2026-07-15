import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { savedItems, watchTargets, type SavedItemRow } from "@/drizzle/schema";
import { getDatabase, type DatabaseClient } from "@/lib/database";
import type { CreateSavedItemInput, UpdateSavedItemSummaryInput } from "@/lib/validation";

function databaseOrDefault(database?: DatabaseClient): DatabaseClient {
  return database ?? getDatabase().db;
}

export type SavedItem = SavedItemRow & { watchTargetName: string };

export function listSavedItems(database?: DatabaseClient): SavedItem[] {
  const db = databaseOrDefault(database);
  return db.select({
    id: savedItems.id,
    watchTargetId: savedItems.watchTargetId,
    watchTargetName: watchTargets.name,
    title: savedItems.title,
    url: savedItems.url,
    sourceDomain: savedItems.sourceDomain,
    contentExcerpt: savedItems.contentExcerpt,
    selectedText: savedItems.selectedText,
    aiSummary: savedItems.aiSummary,
    createdAt: savedItems.createdAt,
    updatedAt: savedItems.updatedAt
  }).from(savedItems).innerJoin(watchTargets, eq(savedItems.watchTargetId, watchTargets.id)).orderBy(desc(savedItems.createdAt)).limit(20).all();
}

export function listRecentSavedItemsForTarget(watchTargetId: string, limit = 12, database?: DatabaseClient): SavedItemRow[] {
  const db = databaseOrDefault(database);
  return db.select().from(savedItems).where(eq(savedItems.watchTargetId, watchTargetId)).orderBy(desc(savedItems.createdAt)).limit(Math.max(1, Math.min(limit, 30))).all();
}

export function createSavedItem(input: CreateSavedItemInput, database?: DatabaseClient): SavedItem | null {
  const db = databaseOrDefault(database);
  const target = db.select({ id: watchTargets.id, name: watchTargets.name }).from(watchTargets).where(eq(watchTargets.id, input.watchTargetId)).get();
  if (!target) return null;
  const parsedUrl = new URL(input.url);
  const now = new Date().toISOString();
  const row: SavedItemRow = {
    id: randomUUID(),
    watchTargetId: target.id,
    title: input.title,
    url: parsedUrl.toString(),
    sourceDomain: parsedUrl.hostname.toLowerCase(),
    contentExcerpt: input.contentExcerpt,
    selectedText: input.selectedText,
    aiSummary: input.aiSummary,
    createdAt: now,
    updatedAt: now
  };
  db.insert(savedItems).values(row).run();
  return { ...row, watchTargetName: target.name };
}

export function updateSavedItemSummary(id: string, input: UpdateSavedItemSummaryInput, database?: DatabaseClient): SavedItem | null {
  const db = databaseOrDefault(database);
  const existing = db.select({ id: savedItems.id }).from(savedItems).where(eq(savedItems.id, id)).get();
  if (!existing) return null;
  db.update(savedItems).set({ aiSummary: input.aiSummary, updatedAt: new Date().toISOString() }).where(eq(savedItems.id, id)).run();
  return db.select({
    id: savedItems.id,
    watchTargetId: savedItems.watchTargetId,
    watchTargetName: watchTargets.name,
    title: savedItems.title,
    url: savedItems.url,
    sourceDomain: savedItems.sourceDomain,
    contentExcerpt: savedItems.contentExcerpt,
    selectedText: savedItems.selectedText,
    aiSummary: savedItems.aiSummary,
    createdAt: savedItems.createdAt,
    updatedAt: savedItems.updatedAt
  }).from(savedItems).innerJoin(watchTargets, eq(savedItems.watchTargetId, watchTargets.id)).where(eq(savedItems.id, id)).get() ?? null;
}
