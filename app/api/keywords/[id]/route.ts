import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteKeyword, updateKeyword } from "@/lib/watch-targets";
import { idSchema, updateKeywordSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    const input = updateKeywordSchema.parse(await request.json());
    const keyword = updateKeyword(id, input);
    return keyword
      ? NextResponse.json({ data: keyword })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "关键词不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    return deleteKeyword(id)
      ? NextResponse.json({ data: { deleted: true } })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "关键词不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
