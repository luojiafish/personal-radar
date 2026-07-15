import { load } from "cheerio";
import { PublicApiError } from "@/lib/api";
import { assertPublicUrl, inspectWebPage } from "@/lib/web-page";

const MAX_SEARCH_HTML_BYTES = 1024 * 1024;

export type PublicSearchSource = {
  title: string;
  url: string;
  excerpt: string;
  pageAge: string;
};

type SearchResult = { title: string; url: string; snippet: string };

export function extractBingSearchResults(html: string): SearchResult[] {
  const $ = load(html);
  const results: SearchResult[] = [];
  $("li.b_algo").each((_index, element) => {
    const link = $(element).find("h2 a").first();
    const title = link.text().replace(/\s+/gu, " ").trim();
    const url = link.attr("href")?.trim() ?? "";
    const snippet = $(element).find(".b_caption p, .b_lineclamp2, .b_lineclamp3").first().text().replace(/\s+/gu, " ").trim();
    if (!title || !/^https?:\/\//iu.test(url)) return;
    results.push({ title: title.slice(0, 300), url, snippet: snippet.slice(0, 1000) });
  });
  const uniqueResults = new Map<string, SearchResult>();
  for (const result of results) {
    if (!uniqueResults.has(result.url)) uniqueResults.set(result.url, result);
  }
  return [...uniqueResults.values()].slice(0, 8);
}

export function extractBingRssSearchResults(xml: string): SearchResult[] {
  const $ = load(xml, { xmlMode: true });
  const results: SearchResult[] = [];
  $("item").each((_index, element) => {
    const title = $(element).find("title").first().text().replace(/\s+/gu, " ").trim();
    const url = $(element).find("link").first().text().trim();
    const descriptionHtml = $(element).find("description").first().text();
    const snippet = load(descriptionHtml).text().replace(/\s+/gu, " ").trim();
    if (!title || !/^https?:\/\//iu.test(url)) return;
    results.push({ title: title.slice(0, 300), url, snippet: snippet.slice(0, 1000) });
  });
  const uniqueResults = new Map<string, SearchResult>();
  for (const result of results) {
    if (!uniqueResults.has(result.url)) uniqueResults.set(result.url, result);
  }
  return [...uniqueResults.values()].slice(0, 8);
}

function buildQuery(input: { targetName: string; keywords: string[]; domains: string[] }): string {
  const terms = [input.targetName, ...input.keywords].map((value) => value.trim()).filter(Boolean);
  const uniqueTerms = [...new Set(terms)].slice(0, 8);
  const termScope = uniqueTerms.length === 1
    ? `"${uniqueTerms[0]}"`
    : `(${uniqueTerms.map((term) => `"${term}"`).join(" OR ")})`;
  const uniqueDomains = [...new Set(input.domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean))].slice(0, 5);
  const siteScope = uniqueDomains.length === 0
    ? ""
    : uniqueDomains.length === 1
      ? `site:${uniqueDomains[0]}`
      : `(${uniqueDomains.map((domain) => `site:${domain}`).join(" OR ")})`;
  return [termScope, siteScope].filter(Boolean).join(" ").slice(0, 800);
}

function normalizeDomains(domains: string[]): string[] {
  return [...new Set(domains.map((domain) => domain.trim().toLowerCase().replace(/^\.+|\.+$/gu, "")).filter(Boolean))].slice(0, 5);
}

export function matchesAllowedDomain(rawUrl: string, domains: string[]): boolean {
  const allowedDomains = normalizeDomains(domains);
  if (allowedDomains.length === 0) return true;
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/\.$/u, "");
    return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function buildSearchQueries(input: { targetName: string; keywords: string[]; domains: string[] }): string[] {
  const domains = normalizeDomains(input.domains);
  if (domains.length === 0) return [buildQuery(input)];
  const terms = [...new Set([input.targetName, ...input.keywords].map((value) => value.trim()).filter(Boolean))].slice(0, 4);
  const siteScope = domains.length === 1
    ? `site:${domains[0]}`
    : `(${domains.map((domain) => `site:${domain}`).join(" OR ")})`;
  return terms.map((term) => `"${term}" ${siteScope}`.slice(0, 800));
}

export async function collectPublicSearchSources(input: { targetName: string; keywords: string[]; domains: string[] }): Promise<{ queries: string[]; sources: PublicSearchSource[] }> {
  const queries = buildSearchQueries(input);
  const allowedDomains = normalizeDomains(input.domains);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const resultGroups = await Promise.all(queries.map(async (query) => {
      const searchUrl = new URL("https://www.bing.com/search");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("count", "8");
      searchUrl.searchParams.set("setlang", "zh-Hans");
      searchUrl.searchParams.set("format", "rss");
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Personal-Radar/0.1",
          Accept: "application/rss+xml,application/xml,text/html"
        }
      });
      if (!response.ok) throw new PublicApiError("PUBLIC_SEARCH_FAILED", `公开搜索返回 ${response.status}`, 502);
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_SEARCH_HTML_BYTES) throw new PublicApiError("PUBLIC_SEARCH_TOO_LARGE", "公开搜索结果页面过大", 502);
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > MAX_SEARCH_HTML_BYTES) throw new PublicApiError("PUBLIC_SEARCH_TOO_LARGE", "公开搜索结果页面过大", 502);
      const rssResults = extractBingRssSearchResults(body);
      return rssResults.length > 0 ? rssResults : extractBingSearchResults(body);
    }));
    const resultMap = new Map<string, SearchResult>();
    for (const result of resultGroups.flat()) {
      if (matchesAllowedDomain(result.url, allowedDomains) && !resultMap.has(result.url)) resultMap.set(result.url, result);
    }
    const results = [...resultMap.values()];
    if (results.length === 0) {
      const message = allowedDomains.length > 0
        ? `指定网站（${allowedDomains.join("、")}）没有返回可读取的公开搜索结果`
        : "公开搜索没有返回可读取的结果";
      throw new PublicApiError("PUBLIC_SEARCH_EMPTY", message, 502);
    }

    const candidates = results.slice(0, 5);
    const inspected = await Promise.all(candidates.map(async (result) => {
      try {
        const page = await inspectWebPage(result.url);
        if (!matchesAllowedDomain(page.url, allowedDomains)) return null;
        return { title: page.title || result.title, url: page.url, excerpt: page.content.slice(0, 6000), pageAge: "" };
      } catch {
        try {
          const safeUrl = await assertPublicUrl(result.url);
          return matchesAllowedDomain(safeUrl.toString(), allowedDomains) && result.snippet.length >= 30
            ? { title: result.title, url: safeUrl.toString(), excerpt: result.snippet, pageAge: "" }
            : null;
        } catch {
          return null;
        }
      }
    }));
    const sources = inspected.filter((source): source is PublicSearchSource => source !== null);
    if (sources.length === 0) throw new PublicApiError("PUBLIC_SEARCH_UNREADABLE", "搜索到了结果，但没有可安全读取的公开正文", 502);
    return { queries, sources: [...new Map(sources.map((source) => [source.url, source])).values()].slice(0, 5) };
  } catch (error) {
    if (error instanceof PublicApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new PublicApiError("PUBLIC_SEARCH_TIMEOUT", "公开搜索超时，请稍后重试", 504);
    throw new PublicApiError("PUBLIC_SEARCH_FAILED", "无法连接公开搜索服务，请稍后重试", 502);
  } finally {
    clearTimeout(timeout);
  }
}
