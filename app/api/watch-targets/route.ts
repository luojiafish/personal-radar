import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createWatchTarget, listWatchTargets } from "@/lib/watch-targets";
import { createWatchTargetSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: listWatchTargets() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createWatchTargetSchema.parse(await request.json());
    return NextResponse.json({ data: createWatchTarget(input) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
