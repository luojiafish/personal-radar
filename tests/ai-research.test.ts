import { describe, expect, it } from "vitest";
import { extractClaudeWebResearch, isProviderRefusalResponse } from "@/lib/ai";

describe("Claude web research response parsing", () => {
  it("extracts organized text, queries and deduplicated source links", () => {
    const result = extractClaudeWebResearch([
      { type: "server_tool_use", name: "web_search", input: { query: "示例研究主题 最新进展" } },
      {
        type: "web_search_tool_result",
        content: [{ type: "web_search_result", title: "学校新闻", url: "https://example.com/news", page_age: "2026-07-14" }]
      },
      {
        type: "text",
        text: "调研概览\n发现一项可核对的新进展。",
        citations: [{ type: "web_search_result_location", title: "学校新闻", url: "https://example.com/news", cited_text: "虚构测试内容。" }]
      }
    ]);

    expect(result.summary).toContain("可核对的新进展");
    expect(result.queries).toEqual(["示例研究主题 最新进展"]);
    expect(result.sources).toEqual([{ title: "学校新闻", url: "https://example.com/news", excerpt: "虚构测试内容。", pageAge: "2026-07-14" }]);
  });

  it("surfaces server-side search errors instead of fabricating results", () => {
    expect(() => extractClaudeWebResearch([
      { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } }
    ])).toThrow("Claude 联网搜索当前不可用");
  });

  it("rejects uncited answers without source links", () => {
    expect(() => extractClaudeWebResearch([{ type: "text", text: "没有来源的回答" }])).toThrow("没有返回可核对的来源链接");
  });

  it("recognizes provider access-denied text as an error response", () => {
    expect(isProviderRefusalResponse("Access Denied: This service is restricted to authorized use through the official Claude Code client only.")).toBe(true);
    expect(isProviderRefusalResponse("调研概览：没有发现新的公开内容。")).toBe(false);
  });
});
