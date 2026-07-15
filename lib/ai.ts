import { PublicApiError } from "@/lib/api";
import { resolveAiRuntimeConfig, type AiRuntimeConfig } from "@/lib/ai-config";
import type { ProfileEvidence, UserProfileContext } from "@/lib/profile-types";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

function endpointFor(config: AiRuntimeConfig): URL {
  const suffix = config.provider === "anthropic"
    ? config.baseUrl.endsWith("/v1") ? "/messages" : "/v1/messages"
    : "/chat/completions";
  try {
    return new URL(`${config.baseUrl}${suffix}`);
  } catch {
    throw new PublicApiError("AI_NOT_CONFIGURED", "CCSwitch 或 AI 服务地址无效", 503);
  }
}

export function isProviderRefusalResponse(text: string): boolean {
  return /^\s*Access Denied\b|restricted to authorized use through the official Claude Code client|unauthorized client/iu.test(text);
}

async function generateText(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const config = resolveAiRuntimeConfig();
  if (!config) throw new PublicApiError("AI_NOT_CONFIGURED", "没有检测到 CCSwitch Claude 配置，也没有可用的 .env.local AI 配置", 503);
  const endpoint = endpointFor(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.provider === "anthropic") {
      headers[config.credentialKind === "bearer" ? "Authorization" : "x-api-key"] = config.credentialKind === "bearer" ? `Bearer ${config.credential}` : config.credential;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers.Authorization = `Bearer ${config.credential}`;
    }
    const body = config.provider === "anthropic"
      ? { model: config.model, max_tokens: maxTokens, temperature: 0.2, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }
      : { model: config.model, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] };
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({})) as ChatCompletionResponse & AnthropicResponse;
    if (!response.ok) throw new PublicApiError("AI_REQUEST_FAILED", payload.error?.message ? `AI 请求失败：${payload.error.message}` : `AI 请求失败（${response.status}）`, 502);
    const summary = config.provider === "anthropic"
      ? payload.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim()
      : payload.choices?.[0]?.message?.content?.trim();
    if (!summary) throw new PublicApiError("AI_EMPTY_RESPONSE", "AI 没有返回内容，请重试", 502);
    if (isProviderRefusalResponse(summary)) {
      throw new PublicApiError("AI_PROVIDER_REJECTED", "当前 CCSwitch 供应商拒绝 Personal Radar 调用；请在 CCSwitch 中切换到允许本地应用 API 请求的 Claude 供应商", 502);
    }
    return summary;
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new PublicApiError("AI_TIMEOUT", "AI 总结超时，请重试", 504);
    throw new PublicApiError("AI_REQUEST_FAILED", "无法连接 AI 服务，请检查 CCSwitch 当前供应商是否可用", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function summarizeWebPage(input: { title: string; url: string; content: string }): Promise<string> {
  const systemPrompt = "你是 Personal Radar 的中文网页摘要助手。只依据提供的正文，输出简洁、可核对的中文摘要。不要推断敏感属性，不要编造正文中没有的信息。使用 3 到 6 个要点，最后用一句话说明与用户关注方向可能相关的事实。";
  const userPrompt = `标题：${input.title}\n网址：${input.url}\n\n正文：\n${input.content.slice(0, 20000)}`;
  return (await generateText(systemPrompt, userPrompt, 1200)).slice(0, 6000);
}

export async function generateDailyReport(input: {
  targetName: string;
  reportDate: string;
  keywords: string[];
  items: Array<{ title: string; url: string; selectedText: string; aiSummary: string; contentExcerpt: string }>;
}): Promise<string> {
  const systemPrompt = "你是 Personal Radar 的中文今日情报编辑。只依据用户主动采集的内容工作。对重复信息合并归纳，按主题分类，区分事实与不确定信息，不推断敏感属性，不编造来源中没有的内容。输出可直接编辑的 Markdown，不要使用代码块。结构包含：今日概览、分类情报、值得继续关注。每条情报保留原始标题并给出简短、可核对的摘要。";
  const sourceText = input.items.map((item, index) => {
    const content = item.aiSummary || item.selectedText || item.contentExcerpt;
    return `【情报 ${index + 1}】\n标题：${item.title}\n网址：${item.url}\n内容：${content.slice(0, 2400)}`;
  }).join("\n\n");
  const userPrompt = `关注对象：${input.targetName}\n业务日期：${input.reportDate}\n启用关键词：${input.keywords.join("、") || "无"}\n\n请基于以下 ${input.items.length} 条已采集情报生成今日情报草稿：\n\n${sourceText}`;
  return (await generateText(systemPrompt, userPrompt.slice(0, 30000), 1800)).slice(0, 12000);
}

export async function generateProfileSuggestionDraftsWithAi(evidence: ProfileEvidence[], context: UserProfileContext): Promise<unknown[]> {
  const systemPrompt = "你是 Personal Radar 的保守型中文兴趣建议助手。每条建议必须同时参考用户明确填写的自我评价、目标/追求，以及用户已经确认进入日报的内容；rationale 说明可核对的日报证据，goalRelation 说明它与用户目标的关系。不得把自我评价扩展成性格诊断，也不得推断人格、生活状态、健康、疾病、政治、宗教、性取向、性别、种族、民族、婚姻、家庭、收入或财务状况。允许的类型只有：current_topic（当前关注主题）、interest_change（有明确时间对比证据的近期变化）、work_learning_direction（仅限内容呈现出的学习或工作方向，不推断职业身份）、keyword（推荐检索关键词）。没有足够证据的类型可以省略。不要编造。只输出 JSON 对象，不要代码块或解释。格式：{\"suggestions\":[{\"kind\":\"current_topic\",\"value\":\"简短建议\",\"rationale\":\"可核对的日报依据\",\"goalRelation\":\"与用户目标的关系\"}]}。总数最多 12 条。";
  const evidenceText = evidence.map((item, index) => `【证据 ${index + 1}】\n日期：${item.reportDate}\n关注对象：${item.targetName}\n标题：${item.title}\n网址：${item.url}\n已确认内容：${item.content.slice(0, 1200)}`).join("\n\n");
  const text = await generateText(systemPrompt, `用户明确填写的自我评价：\n${context.selfAssessment}\n\n用户明确填写的目标/追求：\n${context.goals}\n\n请结合以下 ${evidence.length} 条已确认内容生成待确认建议：\n\n${evidenceText}`.slice(0, 30000), 1600);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new PublicApiError("AI_INVALID_RESPONSE", "AI 返回的画像建议格式无效，请重试", 502);
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { suggestions?: unknown };
    if (!Array.isArray(parsed.suggestions)) throw new Error("missing suggestions");
    return parsed.suggestions;
  } catch {
    throw new PublicApiError("AI_INVALID_RESPONSE", "AI 返回的画像建议格式无效，请重试", 502);
  }
}
