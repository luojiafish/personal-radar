"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type TargetOption = { id: string; name: string; enabled: boolean };
type InspectedPage = { title: string; url: string; domain: string; content: string; excerpt: string; loginMayBeRequired: boolean };
type SavedItem = { id: string; watchTargetName: string; title: string; url: string; sourceDomain: string; contentExcerpt: string; selectedText: string; aiSummary: string; createdAt: string };
type ApiResponse<T> = { data?: T; error?: { message: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message ?? "请求失败");
  return payload.data;
}

export function SavedItemWorkbench({ targets }: { targets: TargetOption[] }) {
  const [url, setUrl] = useState("");
  const [targetId, setTargetId] = useState("");
  const [page, setPage] = useState<InspectedPage | null>(null);
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<SavedItem[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewItemId, setReviewItemId] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [summarizingItemId, setSummarizingItemId] = useState("");
  const [confirmingSummary, setConfirmingSummary] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setItems(await requestJson<SavedItem[]>("/api/saved-items"));
    } catch {
      // 采集记录不是首屏阻塞项。
    }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);
  useEffect(() => {
    const refreshOnReturn = () => { if (document.visibilityState === "visible") void loadItems(); };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [loadItems]);
  useEffect(() => {
    if (!targets.some((target) => target.id === targetId)) setTargetId(targets.find((target) => target.enabled)?.id ?? targets[0]?.id ?? "");
  }, [targetId, targets]);

  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReading(true);
    setError("");
    setStatus("正在读取公开网页并提取正文…");
    setPage(null);
    setSummary("");
    try {
      const inspected = await requestJson<InspectedPage>("/api/web-pages/inspect", { method: "POST", body: JSON.stringify({ url }) });
      setPage(inspected);
      setUrl(inspected.url);
      setStatus(inspected.loginMayBeRequired ? "已读取，但页面出现登录提示；请核对正文是否完整。" : "正文已提取，可以生成 AI 摘要。");
    } catch (readError) {
      setStatus("");
      setError(readError instanceof Error ? readError.message : "网页读取失败");
    } finally {
      setReading(false);
    }
  }

  async function summarize() {
    if (!page) return;
    setSummarizing(true);
    setError("");
    setStatus("正在调用 AI 生成摘要…");
    try {
      const result = await requestJson<{ summary: string }>("/api/ai/summarize", { method: "POST", body: JSON.stringify({ title: page.title, url: page.url, content: page.content }) });
      setSummary(result.summary);
      setStatus("AI 摘要已生成，请确认后收录。");
    } catch (summaryError) {
      setStatus("");
      setError(summaryError instanceof Error ? summaryError.message : "AI 总结失败");
    } finally {
      setSummarizing(false);
    }
  }

  async function save() {
    if (!page || !targetId) return;
    setSaving(true);
    setError("");
    try {
      await requestJson<SavedItem>("/api/saved-items", { method: "POST", body: JSON.stringify({ watchTargetId: targetId, title: page.title, url: page.url, contentExcerpt: page.excerpt, selectedText: "", aiSummary: summary }) });
      setPage(null);
      setSummary("");
      setUrl("");
      setStatus("已收录到本地情报库。");
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "收录失败");
    } finally {
      setSaving(false);
    }
  }

  async function summarizeSavedItem(item: SavedItem) {
    if (item.contentExcerpt.trim().length < 50) {
      setError("这条采集内容的正文太短，无法生成可靠摘要。");
      return;
    }
    setSummarizingItemId(item.id);
    setReviewItemId(item.id);
    setReviewSummary(item.aiSummary);
    setError("");
    setStatus("正在为扩展采集内容调用 AI 生成摘要…");
    try {
      const result = await requestJson<{ summary: string }>("/api/ai/summarize", { method: "POST", body: JSON.stringify({ title: item.title, url: item.url, content: item.contentExcerpt }) });
      setReviewSummary(result.summary);
      setStatus("摘要已生成，确认后才会写入这条采集记录。");
    } catch (summaryError) {
      setStatus("");
      setError(summaryError instanceof Error ? summaryError.message : "AI 总结失败");
    } finally {
      setSummarizingItemId("");
    }
  }

  async function confirmSavedItemSummary(itemId: string) {
    setConfirmingSummary(true);
    setError("");
    try {
      await requestJson<SavedItem>(`/api/saved-items/${itemId}`, { method: "PATCH", body: JSON.stringify({ aiSummary: reviewSummary }) });
      setReviewItemId("");
      setReviewSummary("");
      setStatus("AI 摘要已确认并保存。");
      await loadItems();
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "摘要保存失败");
    } finally {
      setConfirmingSummary(false);
    }
  }

  return (
    <section className="glass-card mt-6 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">情报采集</p>
          <h2 className="mt-1 text-xl font-semibold text-white">粘贴 URL，提取正文并收录到雷达</h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-slate-500">公开网页可直接读取；遇到 401/403 时，请打开具体内容页面并使用扩展主动采集。</p>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={inspect}>
        <input className="text-field" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" aria-label="网页 URL" required />
        <button className="primary-button shrink-0 px-6" disabled={reading}>{reading ? "正在读取…" : "读取网页"}</button>
      </form>
      {error && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
      {status && <div className="mt-4 rounded-2xl border border-indigo-300/15 bg-indigo-400/6 px-4 py-3 text-sm text-indigo-100">{status}</div>}

      {page && (
        <div className="target-card mt-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">{page.domain}</div>
              <h3 className="mt-1 text-lg font-semibold text-white">{page.title}</h3>
              <a className="mt-1 block truncate text-xs text-indigo-300 hover:text-indigo-200" href={page.url} target="_blank" rel="noreferrer">{page.url}</a>
            </div>
            <button className="secondary-button shrink-0" type="button" onClick={() => void summarize()} disabled={summarizing}>{summarizing ? "正在总结…" : "AI 总结"}</button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="field-label">正文预览</div>
              <div className="subtle-scrollbar max-h-56 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/8 bg-slate-950/25 p-4 text-sm leading-6 text-slate-300">{page.excerpt}</div>
            </div>
            <div>
              <label className="field-label" htmlFor="ai-summary">AI 摘要（可修改）</label>
              <textarea id="ai-summary" className="text-field subtle-scrollbar min-h-56 resize-none" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="点击“AI 总结”后显示；未配置 AI 时也可以先保存正文摘录。" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <label className="flex min-w-0 items-center gap-3 text-xs text-slate-400">
              保存到
              <select className="text-field min-w-48 py-2.5" value={targetId} onChange={(event) => setTargetId(event.target.value)} aria-label="选择关注对象">
                {targets.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}
              </select>
            </label>
            <button className="primary-button shrink-0" type="button" onClick={() => void save()} disabled={saving || !targetId}>{saving ? "正在保存…" : "确认收录"}</button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 border-t border-white/8 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-200">最近采集</div>
            <button className="ghost-button" type="button" onClick={() => void loadItems()}>刷新采集记录</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {items.slice(0, 6).map((item) => (
              <article className="rounded-2xl border border-white/8 bg-white/3 p-4 transition hover:border-indigo-300/20 hover:bg-indigo-400/6" key={item.id}>
                <a className="block" href={item.url} target="_blank" rel="noreferrer">
                  <div className="text-xs text-indigo-300">{item.watchTargetName} · {item.sourceDomain}</div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-100">{item.title}</div>
                  <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.aiSummary || item.selectedText || item.contentExcerpt}</div>
                </a>
                {item.selectedText && <div className="mt-3 rounded-xl border border-amber-200/10 bg-amber-300/5 px-3 py-2 text-[11px] leading-5 text-amber-100/70">已保存选中文字</div>}
                <div className="mt-3 flex justify-end">
                  <button className="secondary-button" type="button" onClick={() => void summarizeSavedItem(item)} disabled={summarizingItemId === item.id}>{summarizingItemId === item.id ? "正在总结…" : item.aiSummary ? "重新总结" : "AI 总结"}</button>
                </div>
                {reviewItemId === item.id && (
                  <div className="mt-3 border-t border-white/8 pt-3">
                    <label className="field-label" htmlFor={`saved-summary-${item.id}`}>AI 摘要（确认后保存）</label>
                    <textarea id={`saved-summary-${item.id}`} className="text-field subtle-scrollbar min-h-36 resize-none" value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} maxLength={6000} />
                    <div className="mt-3 flex justify-end gap-2">
                      <button className="ghost-button" type="button" onClick={() => setReviewItemId("")}>取消</button>
                      <button className="primary-button" type="button" onClick={() => void confirmSavedItemSummary(item.id)} disabled={confirmingSummary || !reviewSummary.trim()}>{confirmingSummary ? "正在保存…" : "确认摘要"}</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
