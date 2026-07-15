import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { listConfirmedProfileSuggestions } from "@/lib/profile-suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: listConfirmedProfileSuggestions() });
  } catch (error) {
    return apiError(error);
  }
}
