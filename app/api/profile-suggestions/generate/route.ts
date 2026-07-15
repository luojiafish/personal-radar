import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { generateProfileSuggestions } from "@/lib/profile-suggestions";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ data: await generateProfileSuggestions() });
  } catch (error) {
    return apiError(error);
  }
}
