import { asc, eq, inArray } from "drizzle-orm";
import { siteLoginStatuses, sources, type SiteLoginStatusRow } from "@/drizzle/schema";
import { getDatabase, type DatabaseClient } from "@/lib/database";
import { normalizeSiteOrigin } from "@/lib/source-urls";
import type { UpdateSiteLoginStatusInput } from "@/lib/validation";

const STATUS_FRESHNESS_MS = 24 * 60 * 60 * 1000;

function databaseOrDefault(database?: DatabaseClient): DatabaseClient {
  return database ?? getDatabase().db;
}

export type SiteLoginStatus = SiteLoginStatusRow & {
  effectiveStatus: "unknown" | "authenticated" | "unauthenticated";
};

function withEffectiveStatus(row: SiteLoginStatusRow): SiteLoginStatus {
  if (!row.checkedAt) return { ...row, effectiveStatus: "unknown" };
  const fresh = Date.now() - new Date(row.checkedAt).getTime() <= STATUS_FRESHNESS_MS;
  return { ...row, effectiveStatus: fresh ? row.status : "unknown" };
}

export function listSiteLoginStatuses(database?: DatabaseClient): SiteLoginStatus[] {
  const db = databaseOrDefault(database);
  const origins = [...new Set(db.select({ origin: sources.origin }).from(sources).all().map((row) => row.origin).filter(Boolean))];
  if (origins.length === 0) return [];
  return db.select().from(siteLoginStatuses).where(inArray(siteLoginStatuses.origin, origins)).orderBy(asc(siteLoginStatuses.displayName)).all().map(withEffectiveStatus);
}

export function updateSiteLoginStatus(input: UpdateSiteLoginStatusInput, database?: DatabaseClient): SiteLoginStatus | null {
  const db = databaseOrDefault(database);
  const origin = normalizeSiteOrigin(input.origin);
  const registered = db.select({ origin: sources.origin }).from(sources).where(eq(sources.origin, origin)).get();
  if (!registered) return null;
  const now = new Date().toISOString();
  db.insert(siteLoginStatuses).values({
    origin,
    displayName: new URL(origin).hostname.replace(/^www\./u, ""),
    status: input.status,
    checkedAt: now,
    checkMethod: input.method,
    detectorVersion: input.detectorVersion,
    updatedAt: now
  }).onConflictDoUpdate({
    target: siteLoginStatuses.origin,
    set: {
      status: input.status,
      checkedAt: now,
      checkMethod: input.method,
      detectorVersion: input.detectorVersion,
      updatedAt: now
    }
  }).run();
  const row = db.select().from(siteLoginStatuses).where(eq(siteLoginStatuses.origin, origin)).get();
  return row ? withEffectiveStatus(row) : null;
}
