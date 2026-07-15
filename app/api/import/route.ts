import { NextResponse } from "next/server";
import { apiError, PublicApiError } from "@/lib/api";
import { importBackupArchive, MAX_BACKUP_UPLOAD_BYTES } from "@/lib/backup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("backup");
    if (!(file instanceof File)) throw new PublicApiError("BACKUP_REQUIRED", "请选择 Personal Radar ZIP 备份", 400);
    if (!file.name.toLowerCase().endsWith(".zip")) throw new PublicApiError("INVALID_FILE_TYPE", "只允许导入 ZIP 备份", 400);
    if (file.size === 0 || file.size > MAX_BACKUP_UPLOAD_BYTES) throw new PublicApiError("BACKUP_TOO_LARGE", "备份文件为空或超过 256 MB", 413);
    const result = await importBackupArchive(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: result });
  } catch (error) {
    return apiError(error);
  }
}
