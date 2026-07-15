import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import { PublicApiError } from "@/lib/api";

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 30000;
const MAX_REDIRECTS = 5;

export type InspectedWebPage = {
  title: string;
  url: string;
  domain: string;
  content: string;
  excerpt: string;
  loginMayBeRequired: boolean;
};

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  const parts = ipv4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicApiError("INVALID_URL", "请输入完整的 http 或 https 网页地址");
  }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new PublicApiError("INVALID_URL", "网页地址只支持 http 或 https");
  if (url.username || url.password) throw new PublicApiError("INVALID_URL", "网页地址不能包含账号或密码");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new PublicApiError("PRIVATE_ADDRESS", "不能读取本机或局域网地址");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new PublicApiError("PRIVATE_ADDRESS", "不能读取本机或局域网地址");
  } else {
    let addresses;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new PublicApiError("DNS_FAILED", "无法解析这个网站地址", 422);
    }
    if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
      throw new PublicApiError("PRIVATE_ADDRESS", "不能读取本机或局域网地址");
    }
  }
  url.hash = "";
  return url;
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_DOWNLOAD_BYTES) throw new PublicApiError("PAGE_TOO_LARGE", "网页内容超过 2 MB，暂不读取", 413);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DOWNLOAD_BYTES) {
      await reader.cancel();
      throw new PublicApiError("PAGE_TOO_LARGE", "网页内容超过 2 MB，暂不读取", 413);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/gu, " ").replace(/[\t\f\v ]+/gu, " ").replace(/\s*\n\s*/gu, "\n").replace(/\n{3,}/gu, "\n\n").trim();
}

function extractPage(html: string, finalUrl: URL): InspectedWebPage {
  const $ = load(html);
  $("script,style,noscript,template,svg,canvas,form,input,textarea,button,nav,footer,header,aside,dialog").remove();
  const title = normalizeText($("meta[property='og:title']").attr("content") ?? $("title").text() ?? $("h1").first().text()).slice(0, 300) || finalUrl.hostname;
  const candidates = [$("article"), $("main"), $("[role='main']"), $("body")];
  let content = "";
  for (const candidate of candidates) {
    const text = normalizeText(candidate.text());
    if (text.length > content.length) content = text;
    if (text.length >= 800) break;
  }
  content = content.slice(0, MAX_EXTRACTED_CHARS);
  if (content.length < 50) throw new PublicApiError("NO_CONTENT", "没有提取到足够的正文，网站可能需要登录或依赖脚本加载", 422);
  const loginSignals = /(?:请先登录|登录后查看|扫码登录|sign\s*in\s*to\s*(?:continue|view)|login\s*required)/iu;
  return {
    title,
    url: finalUrl.toString(),
    domain: finalUrl.hostname,
    content,
    excerpt: content.slice(0, 3000),
    loginMayBeRequired: loginSignals.test(`${title}\n${content.slice(0, 1200)}`)
  };
}

export async function inspectWebPage(rawUrl: string): Promise<InspectedWebPage> {
  let currentUrl = await assertPublicUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "Personal-Radar/0.1 (+local user initiated fetch)", Accept: "text/html,application/xhtml+xml,text/plain;q=0.8" }
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new PublicApiError("FETCH_TIMEOUT", "读取网页超时，请稍后重试", 504);
        throw new PublicApiError("FETCH_FAILED", "无法连接这个网页；如果网站需要登录，请改用浏览器扩展", 422);
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new PublicApiError("REDIRECT_FAILED", "网页重定向地址无效", 422);
        currentUrl = await assertPublicUrl(new URL(location, currentUrl).toString());
        continue;
      }
      if (!response.ok) {
        const loginHint = response.status === 401 || response.status === 403 ? "；请打开具体页面并使用扩展采集" : "";
        throw new PublicApiError("FETCH_FAILED", `网页返回 ${response.status}${loginHint}`, 422);
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!(contentType.includes("text/html") || contentType.includes("application/xhtml+xml") || contentType.includes("text/plain"))) {
        throw new PublicApiError("UNSUPPORTED_CONTENT", "当前只支持普通网页正文", 415);
      }
      return extractPage(await readLimitedText(response), currentUrl);
    }
    throw new PublicApiError("TOO_MANY_REDIRECTS", "网页重定向次数过多", 422);
  } finally {
    clearTimeout(timeout);
  }
}
