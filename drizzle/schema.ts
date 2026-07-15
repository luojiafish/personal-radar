import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const utcNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const watchTargets = sqliteTable("watch_targets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(utcNow),
  updatedAt: text("updated_at").notNull().default(utcNow)
}, (table) => [index("watch_targets_updated_idx").on(table.updatedAt)]);

export const keywords = sqliteTable("keywords", {
  id: text("id").primaryKey(),
  watchTargetId: text("watch_target_id").notNull().references(() => watchTargets.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  origin: text("origin", { enum: ["user", "ai"] }).notNull().default("user"),
  createdAt: text("created_at").notNull().default(utcNow),
  updatedAt: text("updated_at").notNull().default(utcNow)
}, (table) => [
  uniqueIndex("keywords_target_normalized_unique").on(table.watchTargetId, table.normalizedValue),
  index("keywords_target_idx").on(table.watchTargetId)
]);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  watchTargetId: text("watch_target_id").notNull().references(() => watchTargets.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  origin: text("origin").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(utcNow),
  updatedAt: text("updated_at").notNull().default(utcNow)
}, (table) => [
  uniqueIndex("sources_target_url_unique").on(table.watchTargetId, table.url),
  index("sources_target_idx").on(table.watchTargetId),
  index("sources_origin_idx").on(table.origin)
]);

export const siteLoginStatuses = sqliteTable("site_login_statuses", {
  origin: text("origin").primaryKey(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: ["unknown", "authenticated", "unauthenticated"] }).notNull().default("unknown"),
  checkedAt: text("checked_at"),
  checkMethod: text("check_method", { enum: ["extension_auto", "extension_user"] }),
  detectorVersion: text("detector_version"),
  updatedAt: text("updated_at").notNull().default(utcNow)
});

export const savedItems = sqliteTable("saved_items", {
  id: text("id").primaryKey(),
  watchTargetId: text("watch_target_id").notNull().references(() => watchTargets.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  sourceDomain: text("source_domain").notNull(),
  contentExcerpt: text("content_excerpt").notNull().default(""),
  selectedText: text("selected_text").notNull().default(""),
  aiSummary: text("ai_summary").notNull().default(""),
  createdAt: text("created_at").notNull().default(utcNow),
  updatedAt: text("updated_at").notNull().default(utcNow)
}, (table) => [
  index("saved_items_target_idx").on(table.watchTargetId),
  index("saved_items_created_idx").on(table.createdAt)
]);

export const dailyReports = sqliteTable("daily_reports", {
  id: text("id").primaryKey(),
  watchTargetId: text("watch_target_id").notNull().references(() => watchTargets.id, { onDelete: "cascade" }),
  reportDate: text("report_date").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull().default(utcNow),
  updatedAt: text("updated_at").notNull().default(utcNow)
}, (table) => [
  uniqueIndex("daily_reports_target_date_unique").on(table.watchTargetId, table.reportDate),
  index("daily_reports_date_idx").on(table.reportDate)
]);

export const dailyReportItems = sqliteTable("daily_report_items", {
  id: text("id").primaryKey(),
  dailyReportId: text("daily_report_id").notNull().references(() => dailyReports.id, { onDelete: "cascade" }),
  savedItemId: text("saved_item_id").notNull().references(() => savedItems.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  createdAt: text("created_at").notNull().default(utcNow)
}, (table) => [
  uniqueIndex("daily_report_items_report_saved_unique").on(table.dailyReportId, table.savedItemId),
  index("daily_report_items_report_idx").on(table.dailyReportId)
]);

export const profileSuggestions = sqliteTable("profile_suggestions", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["current_topic", "interest_change", "work_learning_direction", "keyword"] }).notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  rationale: text("rationale").notNull(),
  evidenceCount: integer("evidence_count").notNull(),
  evidenceStartDate: text("evidence_start_date").notNull(),
  evidenceEndDate: text("evidence_end_date").notNull(),
  confirmedAt: text("confirmed_at").notNull(),
  createdAt: text("created_at").notNull().default(utcNow)
}, (table) => [
  uniqueIndex("profile_suggestions_kind_value_unique").on(table.kind, table.normalizedValue),
  index("profile_suggestions_confirmed_idx").on(table.confirmedAt)
]);

export type WatchTargetRow = typeof watchTargets.$inferSelect;
export type KeywordRow = typeof keywords.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;
export type SiteLoginStatusRow = typeof siteLoginStatuses.$inferSelect;
export type SavedItemRow = typeof savedItems.$inferSelect;
export type DailyReportRow = typeof dailyReports.$inferSelect;
export type DailyReportItemRow = typeof dailyReportItems.$inferSelect;
export type ProfileSuggestionRow = typeof profileSuggestions.$inferSelect;
