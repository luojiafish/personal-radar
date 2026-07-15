"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { SavedItemWorkbench } from "@/components/saved-item-workbench";
import { SiteLoginStatusPanel } from "@/components/site-login-status-panel";
import { AiStatusStrip } from "@/components/ai-status-strip";
import { DailyReportWorkbench } from "@/components/daily-report-workbench";
import { ProfileSuggestionsWorkbench } from "@/components/profile-suggestions-workbench";
import { BackupPanel } from "@/components/backup-panel";

type Keyword = {
  id: string;
  value: string;
  normalizedValue: string;
  enabled: boolean;
};

type Source = {
  id: string;
  name: string;
  url: string;
  domain: string;
  origin: string;
  enabled: boolean;
};

type WatchTarget = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
  keywords: Keyword[];
  sources: Source[];
};

type ApiResponse<T> = { data?: T; error?: { message: string } };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(url, {
    ...init,
    headers
  });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message ?? "请求失败");
  return payload.data;
}

export function RadarDashboard() {
  const [targets, setTargets] = useState<WatchTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keywordText, setKeywordText] = useState("");
  const [websiteText, setWebsiteText] = useState("");
  const [newKeywords, setNewKeywords] = useState<Record<string, string>>({});
  const [newSources, setNewSources] = useState<Record<string, string>>({});
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);
  const [editingKeywordValue, setEditingKeywordValue] = useState("");
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const loadTargets = useCallback(async () => {
    try {
      setError("");
      setTargets(await requestJson<WatchTarget[]>("/api/watch-targets"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let animationFrame = 0;
    const updatePointerGlow = (event: PointerEvent) => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
      });
    };
    window.addEventListener("pointermove", updatePointerGlow, { passive: true });
    return () => {
      window.removeEventListener("pointermove", updatePointerGlow);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  async function createTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const keywords = keywordText.split(/[，,\n]/u).map((value) => value.trim()).filter(Boolean);
      const websites = websiteText.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
      await requestJson<WatchTarget>("/api/watch-targets", {
        method: "POST",
        body: JSON.stringify({ name, description, keywords, websites })
      });
      setName("");
      setDescription("");
      setKeywordText("");
      setWebsiteText("");
      await loadTargets();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTarget(target: WatchTarget) {
    try {
      await requestJson(`/api/watch-targets/${target.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !target.enabled }) });
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新失败");
    }
  }

  function startEditing(target: WatchTarget) {
    setEditingTargetId(target.id);
    setEditName(target.name);
    setEditDescription(target.description);
  }

  async function saveTarget(targetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await requestJson(`/api/watch-targets/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, description: editDescription })
      });
      setEditingTargetId(null);
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新失败");
    }
  }

  async function toggleKeyword(keyword: Keyword) {
    try {
      await requestJson(`/api/keywords/${keyword.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !keyword.enabled }) });
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新失败");
    }
  }

  function startEditingKeyword(keyword: Keyword) {
    setEditingKeywordId(keyword.id);
    setEditingKeywordValue(keyword.value);
  }

  async function saveKeyword(keyword: Keyword, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = editingKeywordValue.trim();
    if (!value) {
      setError("关键词不能为空");
      return;
    }
    try {
      await requestJson(`/api/keywords/${keyword.id}`, { method: "PATCH", body: JSON.stringify({ value }) });
      setEditingKeywordId(null);
      setEditingKeywordValue("");
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "修改关键词失败");
    }
  }

  async function removeKeyword(keyword: Keyword) {
    if (!window.confirm(`确定删除关键词“${keyword.value}”吗？`)) return;
    try {
      await requestJson(`/api/keywords/${keyword.id}`, { method: "DELETE" });
      if (editingKeywordId === keyword.id) setEditingKeywordId(null);
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "删除关键词失败");
    }
  }

  async function addKeyword(targetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = newKeywords[targetId]?.trim();
    if (!value) return;
    try {
      await requestJson(`/api/watch-targets/${targetId}/keywords`, { method: "POST", body: JSON.stringify({ value }) });
      setNewKeywords((current) => ({ ...current, [targetId]: "" }));
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "添加失败");
    }
  }

  async function toggleSource(source: Source) {
    try {
      await requestJson(`/api/sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !source.enabled }) });
      await loadTargets();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新失败");
    }
  }

  async function removeSource(source: Source) {
    if (!window.confirm(`确定删除网站来源“${source.name}”吗？已收录的情报不会删除。`)) return;
    try {
      await requestJson(`/api/sources/${source.id}`, { method: "DELETE" });
      await loadTargets();
      window.dispatchEvent(new Event("personal-radar:sources-changed"));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "删除网站失败");
    }
  }

  async function addSource(targetId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = newSources[targetId]?.trim();
    if (!url) return;
    try {
      await requestJson(`/api/watch-targets/${targetId}/sources`, { method: "POST", body: JSON.stringify({ url }) });
      setNewSources((current) => ({ ...current, [targetId]: "" }));
      await loadTargets();
      window.dispatchEvent(new Event("personal-radar:sources-changed"));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "添加网站失败");
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-xs tracking-[0.18em] text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              本机运行 · 127.0.0.1:3210
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">雷达工作台</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">管理关注对象，把主动采集的内容整理成自己的情报。</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-right backdrop-blur-xl">
            <div className="text-2xl font-semibold text-white">{targets.length}</div>
            <div className="text-xs text-slate-400">关注对象</div>
          </div>
        </header>

        {error && <div className="mb-6 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

        <section className="module-content">
        <AiStatusStrip />

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.4fr]">
          <form onSubmit={createTarget} className="glass-card h-fit p-6">
            <div className="mb-6">
              <p className="eyebrow">新建关注</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">让一个主题进入雷达</h2>
            </div>
            <label className="field-label" htmlFor="target-name">名称</label>
            <input id="target-name" className="text-field" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：多模态大模型" maxLength={100} required />
            <label className="field-label mt-5" htmlFor="target-description">说明</label>
            <textarea id="target-description" className="text-field min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="你为什么关注它？" maxLength={500} />
            <label className="field-label mt-5" htmlFor="target-keywords">初始关键词</label>
            <textarea id="target-keywords" className="text-field min-h-28 resize-y" value={keywordText} onChange={(event) => setKeywordText(event.target.value)} placeholder={"一行一个，或用逗号分隔\n留空时使用对象名称"} />
            <label className="field-label mt-5" htmlFor="target-websites">指定网站（可选）</label>
            <textarea id="target-websites" className="text-field subtle-scrollbar min-h-32 resize-none" value={websiteText} onChange={(event) => setWebsiteText(event.target.value)} placeholder={"一行一个，例如：\nhttps://news.example.com\n留空时暂不设置精品渠道"} />
            <p className="mt-2 text-xs leading-5 text-slate-500">网站会按主站保存，例如同一站点的页面会统一归到对应域名；留空时暂不设置精品渠道。</p>
            <button className="primary-button mt-6 w-full" disabled={saving}>{saving ? "正在保存…" : "添加到雷达"}</button>
          </form>

          <section className="glass-card min-w-0 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">关注列表</p>
                <h2 className="mt-1 text-xl font-semibold text-white">当前关注</h2>
              </div>
              <button className="ghost-button" onClick={() => void loadTargets()} type="button">刷新</button>
            </div>

            <SiteLoginStatusPanel />

            {loading ? (
              <div className="target-card p-10 text-center text-slate-400">正在读取本地数据库…</div>
            ) : targets.length === 0 ? (
              <div className="target-card border-dashed p-10 text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-400/10 text-2xl">⌁</div>
                <p className="font-medium text-slate-200">雷达还没有目标</p>
                <p className="mt-2 text-sm text-slate-400">从左侧创建第一个关注对象。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {targets.map((target) => (
                  <article key={target.id} className={`target-card p-5 transition ${target.enabled ? "" : "opacity-55"}`}>
                    {editingTargetId === target.id ? (
                      <form onSubmit={(event) => void saveTarget(target.id, event)} className="rounded-2xl border border-indigo-300/15 bg-indigo-400/5 p-4">
                        <label className="field-label" htmlFor={`edit-name-${target.id}`}>名称</label>
                        <input id={`edit-name-${target.id}`} className="text-field" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} required />
                        <label className="field-label mt-4" htmlFor={`edit-description-${target.id}`}>说明</label>
                        <textarea id={`edit-description-${target.id}`} className="text-field min-h-20 resize-y" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={500} />
                        <div className="mt-4 flex justify-end gap-2">
                          <button className="ghost-button" type="button" onClick={() => setEditingTargetId(null)}>取消</button>
                          <button className="secondary-button" type="submit">保存</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${target.enabled ? "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.75)]" : "bg-slate-500"}`} />
                            <h3 className="text-lg font-semibold text-white">{target.name}</h3>
                          </div>
                          {target.description && <p className="mt-2 text-sm leading-6 text-slate-400">{target.description}</p>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button className="ghost-button" onClick={() => startEditing(target)} type="button">编辑</button>
                          <button className="ghost-button" onClick={() => void toggleTarget(target)} type="button">{target.enabled ? "停用" : "启用"}</button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {target.keywords.map((keyword) => (
                        editingKeywordId === keyword.id ? (
                          <form className="keyword-editor" key={keyword.id} onSubmit={(event) => void saveKeyword(keyword, event)}>
                            <input value={editingKeywordValue} onChange={(event) => setEditingKeywordValue(event.target.value)} aria-label={`修改关键词 ${keyword.value}`} autoFocus maxLength={120} />
                            <button type="submit" title="保存关键词">保存</button>
                            <button type="button" title="取消修改" onClick={() => setEditingKeywordId(null)}>取消</button>
                          </form>
                        ) : (
                          <span key={keyword.id} className={`keyword-chip ${keyword.enabled ? "keyword-chip-active" : "keyword-chip-disabled"}`}>
                            <button className="keyword-chip-label" type="button" onClick={() => void toggleKeyword(keyword)} title={keyword.enabled ? "点击停用" : "点击启用"}>
                              {keyword.value}<span>{keyword.enabled ? "✓" : "×"}</span>
                            </button>
                            <button className="keyword-chip-action" type="button" onClick={() => startEditingKeyword(keyword)} aria-label={`修改关键词 ${keyword.value}`} title="修改">改</button>
                            <button className="keyword-chip-action keyword-chip-delete" type="button" onClick={() => void removeKeyword(keyword)} aria-label={`删除关键词 ${keyword.value}`} title="删除">删</button>
                          </span>
                        )
                      ))}
                    </div>

                    <div className="mt-5 border-t border-white/8 pt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold tracking-wide text-slate-300">精品渠道</span>
                        <span className="text-xs text-slate-500">{target.sources.filter((source) => source.enabled).length > 0 ? "已启用指定网站" : "尚未添加"}</span>
                      </div>
                      {target.sources.length > 0 ? (
                        <div className="space-y-2">
                          {target.sources.map((source) => (
                            <div key={source.id} className={`source-row ${source.enabled ? "" : "opacity-50"}`}>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-slate-200">{source.name}</div>
                                <div className="truncate text-xs text-slate-500">{source.url}</div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button className="ghost-button" type="button" onClick={() => void toggleSource(source)}>{source.enabled ? "停用" : "启用"}</button>
                                <button className="ghost-button source-delete-button" type="button" onClick={() => void removeSource(source)} aria-label={`删除网站 ${source.name}`}>删除</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-indigo-300/15 bg-indigo-400/5 px-4 py-3 text-xs leading-5 text-slate-400">
                          尚未添加精品渠道，可在日常浏览或运行调研 Skill 后补充。
                        </div>
                      )}
                      <form onSubmit={(event) => void addSource(target.id, event)} className="mt-3 flex gap-2">
                        <input className="text-field py-2.5" value={newSources[target.id] ?? ""} onChange={(event) => setNewSources((current) => ({ ...current, [target.id]: event.target.value }))} placeholder="添加网站地址，例如 example.com" maxLength={2048} />
                        <button className="secondary-button shrink-0">添加网站</button>
                      </form>
                    </div>

                    <form onSubmit={(event) => void addKeyword(target.id, event)} className="mt-5 flex gap-2">
                      <input className="text-field py-2.5" value={newKeywords[target.id] ?? ""} onChange={(event) => setNewKeywords((current) => ({ ...current, [target.id]: event.target.value }))} placeholder="添加关键词" maxLength={120} />
                      <button className="secondary-button shrink-0">添加</button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <SavedItemWorkbench targets={targets.map(({ id, name: targetName, enabled }) => ({ id, name: targetName, enabled }))} />
        <DailyReportWorkbench targets={targets.map(({ id, name: targetName, enabled }) => ({ id, name: targetName, enabled }))} />
        <ProfileSuggestionsWorkbench />
        <BackupPanel />
        </section>
      </div>
    </main>
  );
}
