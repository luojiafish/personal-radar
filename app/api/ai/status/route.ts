import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getSafeAiStatus } from "@/lib/ai-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: getSafeAiStatus() });
  } catch (error) {
    return apiError(error);
  }
}
