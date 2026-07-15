import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getProfileContext, updateProfileContext } from "@/lib/profile-suggestions";
import { profileContextSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: getProfileContext() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    return NextResponse.json({ data: updateProfileContext(profileContextSchema.parse(await request.json())) });
  } catch (error) {
    return apiError(error);
  }
}
