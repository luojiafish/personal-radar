import { NextResponse } from "next/server";
import { summarizeWebPage } from "@/lib/ai";
import { apiError } from "@/lib/api";
import { summarizeWebPageSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = summarizeWebPageSchema.parse(await request.json());
    return NextResponse.json({ data: { summary: await summarizeWebPage(input) } });
  } catch (error) {
    return apiError(error);
  }
}
