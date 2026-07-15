import { describe, expect, it } from "vitest";
import { normalizeKeyword, uniqueKeywords } from "@/lib/keywords";

describe("keyword normalization", () => {
  it("normalizes Unicode width, case and whitespace", () => {
    expect(normalizeKeyword("  ＡＩ   Agent  ")).toBe("ai agent");
  });

  it("keeps the first display value while removing normalized duplicates", () => {
    expect(uniqueKeywords(["AI", "ａｉ", "  AI ", "大模型"])).toEqual([
      { value: "AI", normalizedValue: "ai" },
      { value: "大模型", normalizedValue: "大模型" }
    ]);
  });
});
