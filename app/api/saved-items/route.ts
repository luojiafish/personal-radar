import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createSavedItem, listSavedItems } from "@/lib/saved-items";
import { createSavedItemSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: listSavedItems() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createSavedItemSchema.parse(await request.json());
    const savedItem = createSavedItem(input);
    return savedItem
      ? NextResponse.json({ data: savedItem }, { status: 201 })
      : NextResponse.json({ error: { code: "NOT_FOUND", message: "关注对象不存在" } }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
