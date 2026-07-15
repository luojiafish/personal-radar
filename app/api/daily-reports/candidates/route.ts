import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listDailyReportCandidates } from "@/lib/daily-reports";
import { businessDateSchema, idSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const watchTargetId = idSchema.parse(url.searchParams.get("watchTargetId"));
    const reportDate = businessDateSchema.parse(url.searchParams.get("reportDate"));
    return NextResponse.json({ data: listDailyReportCandidates(watchTargetId, reportDate) });
  } catch (error) {
    return apiError(error);
  }
}
