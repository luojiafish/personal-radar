import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class PublicApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export function apiError(error: unknown, fallbackCode = "INTERNAL_ERROR") {
  if (error instanceof PublicApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const message = firstIssue?.code === "unrecognized_keys" ? "请求包含不允许的字段" : firstIssue?.message ?? "请求无效";
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message } }, { status: 400 });
  }
  if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
    return NextResponse.json({ error: { code: "DUPLICATE", message: "相同关键词已经存在" } }, { status: 409 });
  }
  return NextResponse.json({ error: { code: fallbackCode, message: "操作失败，请稍后重试" } }, { status: 500 });
}
