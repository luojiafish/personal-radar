import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { createSavedItemSchema } from "@/lib/validation";

class FakeElement {
  removed = false;
  hidden = false;
  isContentEditable = false;
  parentElement: FakeElement | null = null;

  constructor(public tagName: string, public text: string, private attributes: Record<string, string> = {}) {}
  getAttribute(name: string) { return this.attributes[name] ?? null; }
  closest() { return null; }
  remove() { this.removed = true; }
}

function runCapture(content: string, selectedText = "用户主动选择的文字") {
  const originals = [
    new FakeElement("P", content),
    new FakeElement("FORM", "登录密码 private-form-value"),
    new FakeElement("DIV", "私信里的秘密", { class: "private-message-panel" }),
    new FakeElement("SECTION", "银行卡支付信息", { id: "checkout-payment" }),
    new FakeElement("P", "不可见内容", { "aria-hidden": "true" })
  ];
  const clones = originals.map((element) => new FakeElement(element.tagName, element.text));
  const cloneRoot = {
    querySelectorAll: () => clones,
    get innerText() { return clones.filter((element) => !element.removed).map((element) => element.text).join("\n"); },
    get textContent() { return this.innerText; }
  };
  const body = {
    querySelectorAll: () => originals,
    cloneNode: () => cloneRoot
  };
  const selectionParent = new FakeElement("P", "");
  selectionParent.parentElement = body as unknown as FakeElement;
  const source = fs.readFileSync(path.resolve("extension/page-capture.js"), "utf8");
  return vm.runInNewContext(`${source}; captureCurrentPage()`, {
    URL,
    location: { href: "https://example.com/articles/42?from=test#section" },
    document: {
      body,
      title: "本地验收文章",
      querySelectorAll: () => [body],
      querySelector: (selector: string) => selector.includes("og:title") ? { getAttribute: () => "本地验收文章" } : null
    },
    getComputedStyle: (element: FakeElement) => ({ display: "block", visibility: "visible", opacity: element.getAttribute("aria-hidden") === "true" ? "0" : "1" }),
    getSelection: () => ({ anchorNode: { parentElement: selectionParent }, focusNode: { parentElement: selectionParent }, toString: () => selectedText })
  }) as { ok: boolean; data: { title: string; url: string; contentExcerpt: string; selectedText: string }; meta: { contentTruncated: boolean; selectionTruncated: boolean } };
}

describe("extension permission boundary", () => {
  it("uses activeTab only and never requests cookies or all-site host access", () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve("extension/manifest.json"), "utf8")) as {
      permissions?: string[];
      host_permissions?: string[];
      optional_host_permissions?: string[];
    };
    expect(manifest.permissions).toEqual(["activeTab", "scripting"]);
    expect(manifest.permissions).not.toContain("cookies");
    expect(manifest.permissions).not.toContain("webRequest");
    expect(manifest.permissions).not.toContain("history");
    expect(manifest.host_permissions).toEqual(["http://127.0.0.1:3210/*"]);
    expect(manifest.optional_host_permissions ?? []).not.toContain("<all_urls>");
  });

  it("cleans sensitive and hidden regions before applying capture limits", () => {
    const visibleContent = "这是本地测试文章的公开正文。".repeat(2400);
    const result = runCapture(visibleContent, "选中文字".repeat(1001));
    expect(result.ok).toBe(true);
    expect(result.data.url).toBe("https://example.com/articles/42?from=test#section");
    expect(result.data.contentExcerpt).toHaveLength(30000);
    expect(result.data.contentExcerpt).not.toContain("密码");
    expect(result.data.contentExcerpt).not.toContain("私信");
    expect(result.data.contentExcerpt).not.toContain("支付");
    expect(result.data.contentExcerpt).not.toContain("不可见");
    expect(result.data.selectedText).toHaveLength(4000);
    expect(result.meta).toEqual({ contentTruncated: true, selectionTruncated: true });
  });

  it("validates the extension payload with a strict field allowlist", () => {
    const valid = {
      watchTargetId: "8b77970e-6f67-4b49-9e25-4a5cc9cbf1b9",
      title: "示例",
      url: "https://example.com/article",
      contentExcerpt: "正文",
      selectedText: "选文",
      aiSummary: ""
    };
    expect(createSavedItemSchema.parse(valid).selectedText).toBe("选文");
    const forbidden = createSavedItemSchema.safeParse({ ...valid, cookie: "forbidden" });
    expect(forbidden.success).toBe(false);
    if (!forbidden.success) expect(forbidden.error.issues[0]?.code).toBe("unrecognized_keys");
    expect(() => createSavedItemSchema.parse({ ...valid, contentExcerpt: "x".repeat(30001) })).toThrow("正文不能超过");
    expect(() => createSavedItemSchema.parse({ ...valid, selectedText: "x".repeat(4001) })).toThrow("选中文字不能超过");
  });

});
