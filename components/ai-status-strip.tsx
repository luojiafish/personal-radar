"use client";

import { useCallback, useEffect, useState } from "react";

type AiStatus = {
  configured: boolean;
  source?: "ccswitch" | "environment" | "env-local";
  provider?: "anthropic" | "openai-compatible";
  model?: string;
  endpointHost?: string;
};

export function AiStatusStrip() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai/status", { cache: "no-store" });
      const payload = await response.json() as { data?: AiStatus };
      if (response.ok && payload.data) setStatus(payload.data);
    } catch {
      setStatus({ configured: false });
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const ready = status?.configured === true;
  const sourceLabel = status?.source === "ccswitch" ? "CCSwitch Claude" : status?.source === "environment" ? "Claude 环境变量" : "自定义 AI";

  return (
    <div className="ai-status-strip mb-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`site-status-dot ${ready ? "site-status-dot-active" : ""}`} />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-200">AI · {ready ? sourceLabel : status ? "未检测到可用配置" : "正在检测配置"}</div>
          <div className="truncate text-[11px] text-slate-500">{ready ? `${status.model} · ${status.endpointHost}` : "优先读取 ~/.claude/settings.json，不在页面保存密钥"}</div>
        </div>
      </div>
      <button className="ghost-button shrink-0" type="button" onClick={() => void refresh()}>重新检测</button>
    </div>
  );
}
