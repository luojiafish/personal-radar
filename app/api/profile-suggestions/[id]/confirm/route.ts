import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { confirmProfileSuggestion } from "@/lib/profile-suggestions";
import { confirmProfileSuggestionSchema, idSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const suggestion = confirmProfileSuggestion(idSchema.parse(id), confirmProfileSuggestionSchema.parse(await request.json()));
    return NextResponse.json({ data: suggestion }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
