export type SearchEngine = "bing" | "baidu";

export const searchEngineLabels: Record<SearchEngine, string> = {
  bing: "必应",
  baidu: "百度"
};

export function isSearchEngine(value: string | null): value is SearchEngine {
  return value === "bing" || value === "baidu";
}

export function buildSearchUrl(engine: SearchEngine, rawQuery: string): string | null {
  const query = rawQuery.trim().replace(/\s+/gu, " ");
  if (!query) return null;
  const encodedQuery = encodeURIComponent(query);
  return engine === "baidu"
    ? `https://www.baidu.com/s?wd=${encodedQuery}`
    : `https://www.bing.com/search?q=${encodedQuery}`;
}
