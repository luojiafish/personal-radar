"use client";

import { ChangeEvent, useState } from "react";

type ErrorPayload = { error?: { message?: string } };

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json() as ErrorPayload;
    return new Error(payload.error?.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

export function BackupPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function exportBackup() {
    setExporting(true);
    setStatus("正在生成一致性数据库快照和 ZIP 备份…");
    setError("");
    try {
      const response = await fetch("/api/export", { method: "POST" });
      if (!response.ok) throw await responseError(response, "导出失败");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "personal-radar-backup.zip";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("备份已生成。ZIP 不包含 API Key、Cookie、登录信息或 .env.local。");
    } catch (exportError) {
      setStatus("");
      setError(exportError instanceof Error ? exportError.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setStatus("");
    setError("");
  }

  async function importBackup() {
    if (!selectedFile) {
      setError("请先选择 Personal Radar ZIP 备份");
      return;
    }
    if (!window.confirm("导入会用备份中的数据库和资料库替换当前数据。系统会先创建安全副本，确定继续吗？")) return;
    setImporting(true);
    setStatus("正在校验 ZIP、SQLite 完整性和文件路径…");
    setError("");
    try {
      const form = new FormData();
      form.set("backup", selectedFile);
      const response = await fetch("/api/import", { method: "POST", body: form });
      if (!response.ok) throw await responseError(response, "导入失败");
      setStatus("导入成功，导入前数据已保留为本地安全副本。页面即将刷新…");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (importError) {
      setStatus("");
      setError(importError instanceof Error ? importError.message : "导入失败；当前数据未被替换");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="glass-card mt-6 p-5 sm:p-6">
      <div className="mb-5">
        <p className="eyebrow">数据与恢复</p>
        <h2 className="mt-1 text-xl font-semibold text-white">导出 ZIP 备份，或从安全备份恢复</h2>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">备份包含 SQLite、`.data/library/` 和非敏感配置。不会包含 CCSwitch 密钥、`.env.local`、Cookie、登录状态凭据或扩展权限。</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="target-card p-5">
          <div className="text-sm font-semibold text-slate-100">导出当前数据</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">导出时先创建 SQLite 一致性快照，不直接复制正在写入的 WAL 文件。</p>
          <button className="primary-button mt-5" type="button" onClick={() => void exportBackup()} disabled={exporting}>{exporting ? "正在生成…" : "导出 personal-radar-backup.zip"}</button>
        </div>

        <div className="target-card p-5">
          <div className="text-sm font-semibold text-slate-100">安全导入</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">只接受结构有效的 ZIP。导入前自动保存当前数据库和资料库；替换失败会自动恢复。</p>
          <label className="mt-4 block cursor-pointer rounded-2xl border border-dashed border-indigo-300/20 bg-indigo-400/5 px-4 py-4 text-xs text-slate-300">
            <span className="block font-medium text-indigo-100">选择 ZIP 备份</span>
            <span className="mt-1 block truncate text-slate-500">{selectedFile?.name ?? "尚未选择文件，最大 256 MB"}</span>
            <input className="sr-only" type="file" accept=".zip,application/zip" onChange={chooseBackup} />
          </label>
          <button className="secondary-button mt-4" type="button" onClick={() => void importBackup()} disabled={importing || !selectedFile}>{importing ? "正在导入…" : "校验并导入"}</button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
      {status && <div className="mt-4 rounded-2xl border border-indigo-300/15 bg-indigo-400/6 px-4 py-3 text-sm text-indigo-100">{status}</div>}
    </section>
  );
}
