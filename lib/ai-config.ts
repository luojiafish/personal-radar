import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type ClaudeSettings = {
  model?: unknown;
  env?: Record<string, unknown>;
};

export type AiRuntimeConfig = {
  provider: "anthropic" | "openai-compatible";
  source: "ccswitch" | "environment" | "env-local";
  baseUrl: string;
  model: string;
  credential: string;
  credentialKind: "bearer" | "api-key";
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCcSwitchClaudeSettings(settings: ClaudeSettings): AiRuntimeConfig | null {
  const env = settings.env ?? {};
  const baseUrl = textValue(env.ANTHROPIC_BASE_URL);
  const authToken = textValue(env.ANTHROPIC_AUTH_TOKEN);
  const apiKey = textValue(env.ANTHROPIC_API_KEY);
  const model = textValue(env.ANTHROPIC_MODEL) || textValue(settings.model);
  const credential = authToken || apiKey;
  if (!baseUrl || !credential || !model) return null;
  return {
    provider: "anthropic",
    source: "ccswitch",
    baseUrl: baseUrl.replace(/\/$/u, ""),
    model,
    credential,
    credentialKind: authToken ? "bearer" : "api-key"
  };
}

function readCcSwitchClaudeConfig(): AiRuntimeConfig | null {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  try {
    return parseCcSwitchClaudeSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")) as ClaudeSettings);
  } catch {
    return null;
  }
}

function readAnthropicEnvironment(): AiRuntimeConfig | null {
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim();
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.ANTHROPIC_MODEL?.trim();
  const credential = authToken || apiKey;
  if (!baseUrl || !credential || !model) return null;
  return {
    provider: "anthropic",
    source: "environment",
    baseUrl: baseUrl.replace(/\/$/u, ""),
    model,
    credential,
    credentialKind: authToken ? "bearer" : "api-key"
  };
}

function readOpenAiCompatibleEnvironment(): AiRuntimeConfig | null {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const credential = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!baseUrl || !credential || !model) return null;
  return {
    provider: "openai-compatible",
    source: "env-local",
    baseUrl: baseUrl.replace(/\/$/u, ""),
    model,
    credential,
    credentialKind: "bearer"
  };
}

export function resolveAiRuntimeConfig(): AiRuntimeConfig | null {
  return readCcSwitchClaudeConfig() ?? readAnthropicEnvironment() ?? readOpenAiCompatibleEnvironment();
}

export function getSafeAiStatus() {
  const config = resolveAiRuntimeConfig();
  if (!config) return { configured: false as const };
  let endpointHost = "本地或自定义端点";
  try {
    endpointHost = new URL(config.baseUrl).host;
  } catch {
    // 配置的完整地址只在服务端使用，不向页面回显。
  }
  return {
    configured: true as const,
    provider: config.provider,
    source: config.source,
    model: config.model,
    endpointHost
  };
}
