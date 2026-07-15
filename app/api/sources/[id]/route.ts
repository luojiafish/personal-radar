import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { deleteSource, updateSource } from "@/lib/watch-targets";
import { idSchema, updateSourceSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    const input = updateSourceSchema.parse(await request.json());
    const source = updateSource(id, input);
    return source
      ? NextResponse.json({ data: source })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "网站来源不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    return deleteSource(id)
      ? NextResponse.json({ data: { deleted: true } })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "网站来源不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
