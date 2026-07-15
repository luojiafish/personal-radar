import { z } from "zod";
import { normalizeSourceUrl } from "@/lib/source-urls";
import { profileSuggestionKinds } from "@/lib/profile-types";

export const idSchema = z.string().uuid();

export const keywordValueSchema = z.string().trim().min(1, "关键词不能为空").max(120, "关键词不能超过 120 个字符");

export const websiteValueSchema = z.string().trim().min(1, "网站地址不能为空").max(2048, "网站地址过长").superRefine((value, context) => {
  try {
    normalizeSourceUrl(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "网站地址无效" });
  }
});

export const createWatchTargetSchema = z.object({
  name: z.string().trim().min(1, "名称不能为空").max(100, "名称不能超过 100 个字符"),
  description: z.string().trim().max(500, "说明不能超过 500 个字符").default(""),
  keywords: z.array(keywordValueSchema).max(50, "一次最多添加 50 个关键词").default([]),
  websites: z.array(websiteValueSchema).max(50, "一次最多添加 50 个网站").default([])
});

export const updateWatchTargetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, "至少提供一个修改字段");

export const createKeywordSchema = z.object({
  value: keywordValueSchema
});

export const updateKeywordSchema = z.object({
  value: keywordValueSchema.optional(),
  enabled: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, "至少提供一个修改字段");

export const createSourceSchema = z.object({
  url: websiteValueSchema,
  name: z.string().trim().max(120, "网站名称不能超过 120 个字符").optional()
});

export const updateSourceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, "至少提供一个修改字段");

export const updateSiteLoginStatusSchema = z.object({
  origin: websiteValueSchema,
  status: z.enum(["authenticated", "unauthenticated", "unknown"]),
  method: z.enum(["extension_auto", "extension_user"]),
  detectorVersion: z.string().trim().max(40).optional()
});

export const inspectWebPageSchema = z.object({
  url: websiteValueSchema
});

export const summarizeWebPageSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: websiteValueSchema,
  content: z.string().trim().min(50, "正文内容太少，无法总结").max(30000, "正文内容过长")
});

export const createSavedItemSchema = z.object({
  watchTargetId: idSchema,
  title: z.string().trim().min(1, "标题不能为空").max(300),
  url: websiteValueSchema,
  contentExcerpt: z.string().trim().max(30000, "正文不能超过 30,000 个字符").default(""),
  selectedText: z.string().trim().max(4000, "选中文字不能超过 4,000 个字符").default(""),
  aiSummary: z.string().trim().max(6000).default("")
}).strict();

export const updateSavedItemSummarySchema = z.object({
  aiSummary: z.string().trim().min(1, "摘要不能为空").max(6000, "摘要不能超过 6,000 个字符")
}).strict();

export const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "日期格式必须为 YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}, "日期无效");

export const dailyReportSelectionSchema = z.object({
  watchTargetId: idSchema,
  reportDate: businessDateSchema,
  itemIds: z.array(idSchema).min(1, "请至少选择一条已采集情报").max(12, "一次最多选择 12 条情报").refine((ids) => new Set(ids).size === ids.length, "情报条目不能重复")
}).strict();

export const createDailyReportSchema = dailyReportSelectionSchema.extend({
  title: z.string().trim().min(1, "日报标题不能为空").max(160, "日报标题不能超过 160 个字符"),
  summary: z.string().trim().min(20, "日报内容至少需要 20 个字符").max(12000, "日报内容不能超过 12,000 个字符")
}).strict();

export const profileSuggestionKindSchema = z.enum(profileSuggestionKinds);

export const confirmProfileSuggestionSchema = z.object({
  kind: profileSuggestionKindSchema,
  value: z.string().trim().min(2, "建议内容太短").max(120, "建议内容不能超过 120 个字符"),
  rationale: z.string().trim().min(2, "建议依据太短").max(400, "建议依据不能超过 400 个字符"),
  evidenceCount: z.number().int().min(2).max(100),
  evidenceStartDate: businessDateSchema,
  evidenceEndDate: businessDateSchema
}).strict();

export type CreateWatchTargetInput = z.infer<typeof createWatchTargetSchema>;
export type UpdateWatchTargetInput = z.infer<typeof updateWatchTargetSchema>;
export type CreateKeywordInput = z.infer<typeof createKeywordSchema>;
export type UpdateKeywordInput = z.infer<typeof updateKeywordSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type UpdateSiteLoginStatusInput = z.infer<typeof updateSiteLoginStatusSchema>;
export type CreateSavedItemInput = z.infer<typeof createSavedItemSchema>;
export type UpdateSavedItemSummaryInput = z.infer<typeof updateSavedItemSummarySchema>;
export type DailyReportSelectionInput = z.infer<typeof dailyReportSelectionSchema>;
export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>;
export type ConfirmProfileSuggestionInput = z.infer<typeof confirmProfileSuggestionSchema>;
