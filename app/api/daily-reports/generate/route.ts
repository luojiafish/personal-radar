import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { generateDailyReportDraft } from "@/lib/daily-reports";
import { dailyReportSelectionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = dailyReportSelectionSchema.parse(await request.json());
    return NextResponse.json({ data: await generateDailyReportDraft(input) });
  } catch (error) {
    return apiError(error);
  }
}
