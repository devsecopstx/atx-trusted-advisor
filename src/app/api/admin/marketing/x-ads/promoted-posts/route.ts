import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createPromotedPost } from "@/modules/marketing/x-ads-client";

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const postText = typeof payload.postText === "string" ? payload.postText : "";
  const accountId = typeof payload.accountId === "string" ? payload.accountId.trim() : "";
  const name = typeof payload.name === "string" ? payload.name : undefined;
  const dailyBudgetUsd = typeof payload.dailyBudgetUsd === "number" ? payload.dailyBudgetUsd : undefined;

  if (!postText.trim() || !accountId) {
    return NextResponse.json({ error: "postText and accountId are required" }, { status: 400 });
  }

  try {
    const result = await createPromotedPost({
      postText,
      accountId,
      name,
      dailyBudgetUsd
    });
    const status = result.success ? 200 : 422;
    return NextResponse.json({ data: result }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ad creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}