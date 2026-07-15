import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listSiteLoginStatuses, updateSiteLoginStatus } from "@/lib/site-login-status";
import { updateSiteLoginStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: listSiteLoginStatuses() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const originHeader = request.headers.get("origin") ?? "";
    if (!originHeader.startsWith("chrome-extension://")) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "只接受浏览器扩展的主动验证结果" } }, { status: 403 });
    }
    const input = updateSiteLoginStatusSchema.parse(await request.json());
    const status = updateSiteLoginStatus(input);
    return status
      ? NextResponse.json({ data: status })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "请先在 Personal Radar 中添加这个主站" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
