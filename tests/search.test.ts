import { describe, expect, it } from "vitest";
import { buildSearchUrl, isSearchEngine } from "@/lib/search";

describe("search URL", () => {
  it("builds encoded Bing and Baidu URLs", () => {
    expect(buildSearchUrl("bing", " 多模态   大模型 ")).toBe("https://www.bing.com/search?q=%E5%A4%9A%E6%A8%A1%E6%80%81%20%E5%A4%A7%E6%A8%A1%E5%9E%8B");
    expect(buildSearchUrl("baidu", "示例研究主题")).toBe("https://www.baidu.com/s?wd=%E7%A4%BA%E4%BE%8B%E7%A0%94%E7%A9%B6%E4%B8%BB%E9%A2%98");
  });

  it("rejects empty queries and unknown stored engines", () => {
    expect(buildSearchUrl("bing", "   ")).toBeNull();
    expect(isSearchEngine("google")).toBe(false);
  });
});
