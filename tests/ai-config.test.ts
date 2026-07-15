import { describe, expect, it } from "vitest";
import { parseCcSwitchClaudeSettings } from "@/lib/ai-config";

describe("CCSwitch Claude configuration", () => {
  it("reads endpoint, token and top-level model", () => {
    const config = parseCcSwitchClaudeSettings({
      model: "claude-test-model",
      env: {
        ANTHROPIC_BASE_URL: "https://claude-proxy.example/v1/",
        ANTHROPIC_AUTH_TOKEN: "test-token"
      }
    });
    expect(config).toEqual({
      provider: "anthropic",
      source: "ccswitch",
      baseUrl: "https://claude-proxy.example/v1",
      model: "claude-test-model",
      credential: "test-token",
      credentialKind: "bearer"
    });
  });

  it("rejects incomplete settings", () => {
    expect(parseCcSwitchClaudeSettings({ model: "claude-test-model", env: {} })).toBeNull();
  });
});
