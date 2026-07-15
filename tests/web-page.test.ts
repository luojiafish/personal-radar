import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectWebPage } from "@/lib/web-page";

afterEach(() => vi.restoreAllMocks());

describe("public web page inspection", () => {
  it("rejects localhost and private addresses", async () => {
    await expect(inspectWebPage("http://127.0.0.1:3210/private")).rejects.toThrow("不能读取本机或局域网地址");
    await expect(inspectWebPage("http://192.168.1.2/private")).rejects.toThrow("不能读取本机或局域网地址");
  });

  it("extracts readable content and removes forms and scripts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`
      <!doctype html><html><head><title>示例文章</title><script>secret()</script></head>
      <body><header>导航</header><main><h1>示例文章</h1><p>这是用于测试网页正文提取的一段公开内容，它需要足够长，确保正文解析器能够识别并返回稳定结果。</p><p>第二段补充更多信息，同时确认脚本、表单和导航不会进入最终的正文预览。</p><form><input value="private" /></form></main></body></html>
    `, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }));

    const page = await inspectWebPage("https://93.184.216.34/article#reply");
    expect(page.title).toBe("示例文章");
    expect(page.url).toBe("https://93.184.216.34/article");
    expect(page.content).toContain("正文提取");
    expect(page.content).not.toContain("secret");
    expect(page.content).not.toContain("private");
  });

  it("directs 401/403 pages to user-initiated extension capture", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } }));
    await expect(inspectWebPage("https://93.184.216.34/protected/article")).rejects.toThrow("请打开具体页面并使用扩展采集");
  });
});
