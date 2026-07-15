import { describe, expect, it } from "vitest";
import { extractBingRssSearchResults, extractBingSearchResults, matchesAllowedDomain } from "@/lib/web-research";

describe("public web search result parsing", () => {
  it("extracts and deduplicates result titles, links and snippets", () => {
    const html = `
      <ol id="b_results">
        <li class="b_algo"><h2><a href="https://example.com/one">虚构新闻一</a></h2><div class="b_caption"><p>这是用于测试的公开搜索摘要内容。</p></div></li>
        <li class="b_algo"><h2><a href="https://example.com/one">重复新闻</a></h2><div class="b_caption"><p>重复内容。</p></div></li>
        <li class="b_algo"><h2><a href="https://example.com/two">虚构新闻二</a></h2><div class="b_caption"><p>第二条虚构测试摘要。</p></div></li>
      </ol>`;
    expect(extractBingSearchResults(html)).toEqual([
      { title: "虚构新闻一", url: "https://example.com/one", snippet: "这是用于测试的公开搜索摘要内容。" },
      { title: "虚构新闻二", url: "https://example.com/two", snippet: "第二条虚构测试摘要。" }
    ]);
  });

  it("extracts stable RSS search results", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title>虚构 RSS 新闻</title><link>https://example.com/rss-news</link><description><![CDATA[<b>摘要</b>：用于测试的公开内容。]]></description></item></channel></rss>`;
    expect(extractBingRssSearchResults(xml)).toEqual([
      { title: "虚构 RSS 新闻", url: "https://example.com/rss-news", snippet: "摘要：用于测试的公开内容。" }
    ]);
  });

  it("accepts only the configured domain and its subdomains", () => {
    expect(matchesAllowedDomain("https://community.example.com/p/123", ["example.com"])).toBe(true);
    expect(matchesAllowedDomain("https://sub.example.com/p/123", ["example.com"])).toBe(true);
    expect(matchesAllowedDomain("https://example.net/example.com", ["example.com"])).toBe(false);
    expect(matchesAllowedDomain("https://example.com.example.net/p/123", ["example.com"])).toBe(false);
    expect(matchesAllowedDomain("not-a-url", ["tieba.baidu.com"])).toBe(false);
  });
});
