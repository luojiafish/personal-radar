import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getWatchTarget, updateWatchTarget } from "@/lib/watch-targets";
import { idSchema, updateWatchTargetSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    const target = getWatchTarget(id);
    return target
      ? NextResponse.json({ data: target })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "关注对象不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    const input = updateWatchTargetSchema.parse(await request.json());
    const target = updateWatchTarget(id, input);
    return target
      ? NextResponse.json({ data: target })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "关注对象不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
