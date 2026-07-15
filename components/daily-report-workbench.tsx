"use client";

import { useCallback, useEffect, useState } from "react";

type TargetOption = { id: string; name: string; enabled: boolean };
type Candidate = {
  id: string;
  title: string;
  url: string;
  sourceDomain: string;
  selectedText: string;
  aiSummary: string;
  contentExcerpt: string;
  createdAt: string;
};
type DailyReport = {
  id: string;
  watchTargetId: string;
  watchTargetName: string;
  reportDate: string;
  title: string;
  summary: string;
  items: Candidate[];
  updatedAt: string;
};
type Draft = { watchTargetId: string; reportDate: string; title: string; summary: string; itemIds: string[] };
type ApiResponse<T> = { data?: T; error?: { message: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message ?? "请求失败");
  return payload.data;
}

function defaultReportDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function DailyReportWorkbench({ targets }: { targets: TargetOption[] }) {
  const [targetId, setTargetId] = useState("");
  const [reportDate, setReportDate] = useState(defaultReportDate);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await requestJson<DailyReport[]>("/api/daily-reports"));
    } catch {
      // 历史记录不是首屏阻塞项。
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (!targets.some((target) => target.id === targetId)) setTargetId(targets.find((target) => target.enabled)?.id ?? targets[0]?.id ?? "");
  }, [targetId, targets]);

  const loadCandidates = useCallback(async () => {
    if (!targetId || !reportDate) return;
    setLoadingCandidates(true);
    setError("");
    setStatus("正在读取当天已采集情报…");
    setDraft(null);
    try {
      const params = new URLSearchParams({ watchTargetId: targetId, reportDate });
      const items = await requestJson<Candidate[]>(`/api/daily-reports/candidates?${params}`);
      setCandidates(items);
      setSelectedIds(items.slice(0, 12).map((item) => item.id));
      setStatus(items.length > 0 ? `找到 ${items.length} 条当天情报，已选择前 ${Math.min(items.length, 12)} 条。` : "当天还没有已采集情报。请打开具体内容页面并使用扩展采集。");
    } catch (loadError) {
      setCandidates([]);
      setSelectedIds([]);
      setStatus("");
      setError(loadError instanceof Error ? loadError.message : "读取候选情报失败");
    } finally {
      setLoadingCandidates(false);
    }
  }, [reportDate, targetId]);

  useEffect(() => { void loadCandidates(); }, [loadCandidates]);

  function toggleCandidate(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= 12) {
        setError("一次最多选择 12 条情报");
        return current;
      }
      setError("");
      return [...current, id];
    });
    setDraft(null);
  }

  async function generate() {
    if (!targetId || selectedIds.length === 0) {
      setError("请先选择至少一条当天情报");
      return;
    }
    setGenerating(true);
    setError("");
    setStatus("正在调用 CCSwitch Claude 分类、去重并生成今日情报草稿…");
    try {
      const generated = await requestJson<Draft>("/api/daily-reports/generate", { method: "POST", body: JSON.stringify({ watchTargetId: targetId, reportDate, itemIds: selectedIds }) });
      setDraft(generated);
      setStatus("草稿已生成。请核对、修改并确认保存。");
    } catch (generateError) {
      setStatus("");
      setError(generateError instanceof Error ? generateError.message : "今日情报生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await requestJson<DailyReport>("/api/daily-reports", { method: "POST", body: JSON.stringify(draft) });
      setStatus("今日情报已确认并保存到本地。");
      setDraft(null);
      await loadHistory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "今日情报保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-card mt-6 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">今日情报</p>
          <h2 className="mt-1 text-xl font-semibold text-white">把当天采集内容整理成一份可确认的日报</h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-slate-500">只使用你主动采集的内容；不会后台抓取、模拟登录或补写不存在的信息。</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
        <label className="text-xs text-slate-400">
          <span className="mb-2 block">关注对象</span>
          <select className="text-field py-2.5" value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={targets.length === 0}>
            {targets.map((target) => <option value={target.id} key={target.id}>{target.name}{target.enabled ? "" : "（已停用）"}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-2 block">业务日期</span>
          <input className="text-field py-2.5" type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
        </label>
        <button className="secondary-button self-end" type="button" onClick={() => void loadCandidates()} disabled={loadingCandidates || !targetId}>{loadingCandidates ? "正在读取…" : "刷新当天情报"}</button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
      {status && <div className="mt-4 rounded-2xl border border-indigo-300/15 bg-indigo-400/6 px-4 py-3 text-sm text-indigo-100">{status}</div>}

      {candidates.length > 0 ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>选择进入草稿的情报</span>
            <span>{selectedIds.length}/12</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {candidates.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <label className={`cursor-pointer rounded-2xl border p-4 transition ${selected ? "border-indigo-300/30 bg-indigo-400/10" : "border-white/8 bg-white/3 opacity-65"}`} key={item.id}>
                  <div className="flex gap-3">
                    <input className="mt-1 accent-indigo-400" type="checkbox" checked={selected} onChange={() => toggleCandidate(item.id)} />
                    <span className="min-w-0">
                      <span className="block text-xs text-indigo-300">{item.sourceDomain}</span>
                      <span className="mt-1 block line-clamp-2 text-sm font-medium text-slate-100">{item.title}</span>
                      <span className="mt-2 block line-clamp-2 text-xs leading-5 text-slate-500">{item.aiSummary || item.selectedText || item.contentExcerpt}</span>
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button className="primary-button" type="button" onClick={() => void generate()} disabled={generating || selectedIds.length === 0}>{generating ? "正在生成…" : "生成今日情报草稿"}</button>
          </div>
        </div>
      ) : !loadingCandidates && targetId ? (
        <div className="target-card mt-5 border-dashed p-6 text-center">
          <div className="text-sm font-medium text-slate-200">当天没有可整理的情报</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">请先打开具体内容页面，通过浏览器扩展“收录到雷达”，再回来刷新。</p>
        </div>
      ) : null}

      {draft && (
        <div className="target-card mt-5 p-5">
          <label className="field-label" htmlFor="daily-report-title">日报标题</label>
          <input id="daily-report-title" className="text-field" value={draft.title} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)} maxLength={160} />
          <label className="field-label mt-4" htmlFor="daily-report-summary">AI 草稿（可修改，确认后保存）</label>
          <textarea id="daily-report-summary" className="text-field subtle-scrollbar min-h-80 resize-y leading-6" value={draft.summary} onChange={(event) => setDraft((current) => current ? { ...current, summary: event.target.value } : current)} maxLength={12000} />
          <div className="mt-4 flex justify-end gap-2">
            <button className="ghost-button" type="button" onClick={() => setDraft(null)}>放弃草稿</button>
            <button className="primary-button" type="button" onClick={() => void confirm()} disabled={saving || draft.summary.trim().length < 20}>{saving ? "正在保存…" : "确认今日情报"}</button>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-white/8 pt-5">
          <div className="mb-3 text-sm font-semibold text-slate-200">最近日报</div>
          <div className="space-y-3">
            {history.map((report) => (
              <details className="rounded-2xl border border-white/8 bg-white/3 p-4 open:border-indigo-300/20 open:bg-indigo-400/6" key={report.id}>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium text-slate-100">{report.title}</span>
                    <span className="text-xs text-slate-500">{report.items.length} 条 · {report.watchTargetName}</span>
                  </div>
                </summary>
                <div className="mt-4 whitespace-pre-wrap border-t border-white/8 pt-4 text-sm leading-6 text-slate-300">{report.summary}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.items.map((item) => <a className="rounded-full border border-white/8 bg-slate-950/25 px-3 py-1.5 text-xs text-indigo-200 hover:border-indigo-300/25" href={item.url} target="_blank" rel="noreferrer" key={item.id}>{item.title}</a>)}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
