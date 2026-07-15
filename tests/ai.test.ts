import { describe, expect, it } from "vitest";
import { isProviderRefusalResponse } from "@/lib/ai";

describe("AI provider responses", () => {
  it("recognizes provider access-denied text as an error response", () => {
    expect(isProviderRefusalResponse("Access Denied: This service is restricted to authorized use through the official Claude Code client only.")).toBe(true);
    expect(isProviderRefusalResponse("今日概览：没有发现新的公开内容。")).toBe(false);
  });
});
