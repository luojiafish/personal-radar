import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { inspectWebPageSchema } from "@/lib/validation";
import { inspectWebPage } from "@/lib/web-page";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = inspectWebPageSchema.parse(await request.json());
    return NextResponse.json({ data: await inspectWebPage(input.url) });
  } catch (error) {
    return apiError(error);
  }
}
