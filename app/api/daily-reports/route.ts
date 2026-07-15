import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listDailyReports, saveDailyReport } from "@/lib/daily-reports";
import { createDailyReportSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: listDailyReports() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createDailyReportSchema.parse(await request.json());
    return NextResponse.json({ data: saveDailyReport(input) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
