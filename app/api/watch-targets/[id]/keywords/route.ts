import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { addKeyword } from "@/lib/watch-targets";
import { createKeywordSchema, idSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const watchTargetId = idSchema.parse((await context.params).id);
    const input = createKeywordSchema.parse(await request.json());
    const keyword = addKeyword(watchTargetId, input);
    return keyword
      ? NextResponse.json({ data: keyword }, { status: 201 })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "关注对象不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
