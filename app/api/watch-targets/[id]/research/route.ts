import { NextResponse } from "next/server";
import { researchWatchTargetWithAi } from "@/lib/ai";
import { apiError } from "@/lib/api";
import { listRecentSavedItemsForTarget } from "@/lib/saved-items";
import { idSchema } from "@/lib/validation";
import { getWatchTarget } from "@/lib/watch-targets";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const id = idSchema.parse((await context.params).id);
    const target = getWatchTarget(id);
    if (!target) return NextResponse.json({ error: { code: "NOT_FOUND", message: "关注对象不存在" } }, { status: 404 });
    if (!target.enabled) return NextResponse.json({ error: { code: "TARGET_DISABLED", message: "请先启用关注对象，再进行 AI 联网搜索" } }, { status: 409 });

    const knownItems = listRecentSavedItemsForTarget(id).map((item) => ({ title: item.title, url: item.url }));
    const result = await researchWatchTargetWithAi({
      targetName: target.name,
      description: target.description,
      keywords: target.keywords.filter((keyword) => keyword.enabled).map((keyword) => keyword.value),
      domains: target.sources.filter((source) => source.enabled).map((source) => source.domain),
      knownItems
    });
    return NextResponse.json({ data: { targetId: id, targetName: target.name, ...result } });
  } catch (error) {
    return apiError(error);
  }
}
