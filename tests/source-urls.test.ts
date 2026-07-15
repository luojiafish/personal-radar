import { describe, expect, it } from "vitest";
import { normalizeSiteOrigin, normalizeSourceUrl, uniqueSourceUrls } from "@/lib/source-urls";

describe("source URL normalization", () => {
  it("adds https and removes fragments and root slashes", () => {
    expect(normalizeSourceUrl("WWW.Example.COM/#section")).toEqual({
      url: "https://www.example.com",
      domain: "www.example.com",
      origin: "https://www.example.com",
      defaultName: "example.com"
    });
  });

  it("collapses a page URL to its exact main-site origin", () => {
    expect(normalizeSiteOrigin("https://news.example.com/posts/123?view=full#reply")).toBe("https://news.example.com");
  });

  it("deduplicates normalized URLs", () => {
    expect(uniqueSourceUrls(["example.com", "https://example.com/"])).toHaveLength(1);
  });

  it("rejects non-http protocols and credentials", () => {
    expect(() => normalizeSourceUrl("file:///C:/secret.txt")).toThrow("只支持 http 或 https");
    expect(() => normalizeSourceUrl("https://user:pass@example.com")).toThrow("不能包含账号或密码");
  });
});
