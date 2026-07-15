export type NormalizedSourceUrl = {
  url: string;
  domain: string;
  origin: string;
  defaultName: string;
};

export function normalizeSourceUrl(rawValue: string): NormalizedSourceUrl {
  const trimmed = rawValue.trim();
  if (!trimmed) throw new Error("网站地址不能为空");
  const candidate = /^[a-z][a-z\d+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("网站地址只支持 http 或 https");
  }
  if (parsed.username || parsed.password) throw new Error("网站地址不能包含账号或密码");

  parsed.hostname = parsed.hostname.toLocaleLowerCase("en-US");
  const origin = parsed.origin;

  return {
    url: origin,
    domain: parsed.hostname,
    origin,
    defaultName: parsed.hostname.replace(/^www\./u, "")
  };
}

export function normalizeSiteOrigin(rawValue: string): string {
  return normalizeSourceUrl(rawValue).origin;
}

export function uniqueSourceUrls(values: readonly string[]): NormalizedSourceUrl[] {
  const seen = new Set<string>();
  const result: NormalizedSourceUrl[] = [];
  for (const value of values) {
    const normalized = normalizeSourceUrl(value);
    if (seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    result.push(normalized);
  }
  return result;
}
