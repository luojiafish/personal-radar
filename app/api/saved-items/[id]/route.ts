import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { updateSavedItemSummary } from "@/lib/saved-items";
import { idSchema, updateSavedItemSummarySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const savedItem = updateSavedItemSummary(idSchema.parse(id), updateSavedItemSummarySchema.parse(await request.json()));
    return savedItem
      ? NextResponse.json({ data: savedItem })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "采集记录不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
