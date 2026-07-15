import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createBackupArchive } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const archive = await createBackupArchive();
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=personal-radar-backup.zip",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
