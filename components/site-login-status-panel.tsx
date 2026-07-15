"use client";

import { useCallback, useEffect, useState } from "react";

type SiteStatus = {
  origin: string;
  displayName: string;
  status: "unknown" | "authenticated" | "unauthenticated";
  effectiveStatus: "unknown" | "authenticated" | "unauthenticated";
  checkedAt: string | null;
};

type ApiResponse<T> = { data?: T; error?: { message: string } };

function formatCheckedAt(value: string | null): string {
  if (!value) return "尚未验证";
  return `检查于 ${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))}`;
}

export function SiteLoginStatusPanel() {
  const [statuses, setStatuses] = useState<SiteStatus[]>([]);

  const loadStatuses = useCallback(async () => {
    try {
      const response = await fetch("/api/site-login-statuses", { cache: "no-store" });
      const payload = await response.json() as ApiResponse<SiteStatus[]>;
      if (response.ok && payload.data) setStatuses(payload.data);
    } catch {
      // 登录状态是辅助信息，读取失败不覆盖主页面错误区。
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
    const interval = window.setInterval(() => void loadStatuses(), 10000);
    const refresh = () => void loadStatuses();
    window.addEventListener("personal-radar:sources-changed", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("personal-radar:sources-changed", refresh);
    };
  }, [loadStatuses]);

  if (statuses.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-white/8 bg-slate-950/20 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-200">网站登录状态</div>
          <div className="mt-1 text-[11px] text-slate-500">打开主站登录后，点击扩展验证；状态只保留 24 小时</div>
        </div>
        <button className="ghost-button shrink-0" type="button" onClick={() => void loadStatuses()}>刷新状态</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {statuses.map((site) => {
          const authenticated = site.effectiveStatus === "authenticated";
          const label = authenticated ? "已登录" : site.status === "unauthenticated" ? "未登录" : "未验证";
          return (
            <a className={`site-status-chip ${authenticated ? "site-status-chip-active" : ""}`} href={site.origin} key={site.origin} target="_blank" rel="noreferrer" title={`${formatCheckedAt(site.checkedAt)}；点击打开主站`}>
              <span className={`site-status-dot ${authenticated ? "site-status-dot-active" : ""}`} />
              <span className="min-w-0">
                <span className="block max-w-40 truncate text-xs font-medium">{site.displayName}</span>
                <span className="block text-[10px] opacity-65">{label}</span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
