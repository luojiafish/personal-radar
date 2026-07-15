import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getDailyReport } from "@/lib/daily-reports";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const report = getDailyReport(idSchema.parse(id));
    return report
      ? NextResponse.json({ data: report })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "今日情报不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
