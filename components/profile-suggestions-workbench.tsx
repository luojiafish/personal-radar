"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type SuggestionKind = "current_topic" | "interest_change" | "work_learning_direction" | "keyword";
type DraftSuggestion = { id: string; kind: SuggestionKind; value: string; rationale: string; goalRelation: string };
type GeneratedSet = { evidenceCount: number; evidenceStartDate: string; evidenceEndDate: string; suggestions: DraftSuggestion[] };
type ConfirmedSuggestion = DraftSuggestion & { evidenceCount: number; evidenceStartDate: string; evidenceEndDate: string; confirmedAt: string };
type ProfileContext = { selfAssessment: string; goals: string; updatedAt?: string };
type ApiResponse<T> = { data?: T; error?: { message: string } };

const kindLabels: Record<SuggestionKind, string> = {
  current_topic: "当前关注主题",
  interest_change: "近期兴趣变化",
  work_learning_direction: "学习 / 工作方向",
  keyword: "推荐关键词"
};

const kindStyles: Record<SuggestionKind, string> = {
  current_topic: "border-indigo-300/20 bg-indigo-400/8 text-indigo-100",
  interest_change: "border-sky-300/20 bg-sky-400/8 text-sky-100",
  work_learning_direction: "border-emerald-300/20 bg-emerald-400/8 text-emerald-100",
  keyword: "border-amber-300/20 bg-amber-400/8 text-amber-100"
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json() as ApiResponse<T>;
  if (!response.ok || payload.data === undefined) throw new Error(payload.error?.message ?? "请求失败");
  return payload.data;
}

export function ProfileSuggestionsWorkbench() {
  const [generated, setGenerated] = useState<GeneratedSet | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedSuggestion[]>([]);
  const [selfAssessment, setSelfAssessment] = useState("");
  const [goals, setGoals] = useState("");
  const [savingContext, setSavingContext] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmingId, setConfirmingId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadConfirmed = useCallback(async () => {
    try {
      setConfirmed(await requestJson<ConfirmedSuggestion[]>("/api/profile-suggestions"));
    } catch {
      // 已确认画像不是首屏阻塞项。
    }
  }, []);

  const loadContext = useCallback(async () => {
    try {
      const context = await requestJson<ProfileContext>("/api/profile-context");
      setSelfAssessment(context.selfAssessment);
      setGoals(context.goals);
    } catch {
      // 资料输入不是首屏阻塞项，提交或生成时仍会显示真实错误。
    }
  }, []);

  useEffect(() => {
    void loadConfirmed();
    void loadContext();
  }, [loadConfirmed, loadContext]);

  async function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingContext(true);
    setError("");
    try {
      await requestJson<ProfileContext>("/api/profile-context", {
        method: "PUT",
        body: JSON.stringify({ selfAssessment, goals })
      });
      setStatus("自我评价和目标已保存到本机；它们只会与已确认日报一起用于画像建议。");
    } catch (saveError) {
      setStatus("");
      setError(saveError instanceof Error ? saveError.message : "画像资料保存失败");
    } finally {
      setSavingContext(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setStatus("正在结合你填写的自我评价、目标和已确认日报生成非敏感建议…");
    setGenerated(null);
    try {
      const result = await requestJson<GeneratedSet>("/api/profile-suggestions/generate", { method: "POST" });
      setGenerated(result);
      setStatus(`已从 ${result.evidenceCount} 条确认内容生成建议。未确认内容尚未写入数据库。`);
    } catch (generateError) {
      setStatus("");
      setError(generateError instanceof Error ? generateError.message : "画像建议生成失败");
    } finally {
      setGenerating(false);
    }
  }

  async function confirm(suggestion: DraftSuggestion) {
    if (!generated) return;
    setConfirmingId(suggestion.id);
    setError("");
    try {
      await requestJson<ConfirmedSuggestion>(`/api/profile-suggestions/${suggestion.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          kind: suggestion.kind,
          value: suggestion.value,
          rationale: suggestion.rationale,
          goalRelation: suggestion.goalRelation,
          evidenceCount: generated.evidenceCount,
          evidenceStartDate: generated.evidenceStartDate,
          evidenceEndDate: generated.evidenceEndDate
        })
      });
      setGenerated((current) => current ? { ...current, suggestions: current.suggestions.filter((item) => item.id !== suggestion.id) } : current);
      setStatus(`已确认“${suggestion.value}”，并保存到本地画像。`);
      await loadConfirmed();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "建议确认失败");
    } finally {
      setConfirmingId("");
    }
  }

  function dismiss(id: string) {
    setGenerated((current) => current ? { ...current, suggestions: current.suggestions.filter((item) => item.id !== id) } : current);
    setStatus("该建议未确认，因此没有写入数据库。");
  }

  return (
    <section className="glass-card mt-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">简单画像</p>
          <h2 className="mt-1 text-xl font-semibold text-white">让目标与确认过的情报相互映照</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">建议必须同时参考你明确填写的资料和已确认日报；不使用未保存的研究热点，不做性格诊断，也不推断健康、政治、宗教等敏感属性。</p>
        </div>
        <button className="primary-button shrink-0" type="button" onClick={() => void generate()} disabled={generating}>{generating ? "正在生成…" : "生成待确认建议"}</button>
      </div>

      <form className="mt-5 grid gap-4 rounded-2xl border border-white/8 bg-white/3 p-4 md:grid-cols-2" onSubmit={(event) => void saveContext(event)}>
        <div>
          <label className="field-label" htmlFor="profile-self-assessment">我的自我评价</label>
          <textarea id="profile-self-assessment" className="text-field mt-2 min-h-28 resize-y" value={selfAssessment} onChange={(event) => setSelfAssessment(event.target.value)} maxLength={2000} placeholder="由你亲自填写，例如当前擅长什么、希望怎样看清自己。" />
        </div>
        <div>
          <label className="field-label" htmlFor="profile-goals">我的目标 / 追求</label>
          <textarea id="profile-goals" className="text-field mt-2 min-h-28 resize-y" value={goals} onChange={(event) => setGoals(event.target.value)} maxLength={2000} placeholder="由你亲自填写，例如近期想达成的学习、工作或长期目标。" />
        </div>
        <div className="md:col-span-2 flex flex-col gap-3 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>两项都保存后才能生成建议；输入只存本机数据库。</span>
          <button className="secondary-button shrink-0" type="submit" disabled={savingContext}>{savingContext ? "正在保存…" : "保存画像资料"}</button>
        </div>
      </form>

      {error && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
      {status && <div className="mt-4 rounded-2xl border border-indigo-300/15 bg-indigo-400/6 px-4 py-3 text-sm text-indigo-100">{status}</div>}

      {generated && generated.suggestions.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex flex-col gap-1 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>待确认建议 · 逐条确认后才保存</span>
            <span>证据 {generated.evidenceStartDate} 至 {generated.evidenceEndDate}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {generated.suggestions.map((suggestion) => (
              <article className={`rounded-2xl border p-4 ${kindStyles[suggestion.kind]}`} key={suggestion.id}>
                <div className="text-[11px] font-semibold tracking-wide opacity-70">{kindLabels[suggestion.kind]}</div>
                <h3 className="mt-2 text-base font-semibold">{suggestion.value}</h3>
                <p className="mt-2 text-xs leading-5 opacity-70">{suggestion.rationale}</p>
                <p className="mt-2 border-t border-current/10 pt-2 text-xs leading-5 opacity-80"><span className="font-semibold">与目标的关系：</span>{suggestion.goalRelation}</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="ghost-button" type="button" onClick={() => dismiss(suggestion.id)}>暂不确认</button>
                  <button className="secondary-button" type="button" onClick={() => void confirm(suggestion)} disabled={confirmingId === suggestion.id}>{confirmingId === suggestion.id ? "正在保存…" : "确认建议"}</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {confirmed.length > 0 ? (
        <div className="mt-6 border-t border-white/8 pt-5">
          <div className="mb-3 text-sm font-semibold text-slate-200">已确认画像</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {confirmed.map((suggestion) => (
              <article className="rounded-2xl border border-white/8 bg-white/3 p-4" key={suggestion.id}>
                <div className="text-[11px] text-indigo-300">{kindLabels[suggestion.kind]}</div>
                <div className="mt-1 text-sm font-medium text-slate-100">{suggestion.value}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">{suggestion.rationale}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">与目标：{suggestion.goalRelation}</div>
                <div className="mt-3 text-[10px] text-slate-600">{suggestion.evidenceCount} 条证据 · {suggestion.evidenceStartDate} 至 {suggestion.evidenceEndDate}</div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="target-card mt-5 border-dashed p-6 text-center">
          <div className="text-sm font-medium text-slate-200">还没有已确认画像</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">先填写画像资料，并积累、确认至少两条日报情报，再逐条确认建议。</p>
        </div>
      )}
    </section>
  );
}
