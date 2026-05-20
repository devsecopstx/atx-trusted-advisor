import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { listXAdsAccounts } from "@/modules/marketing/x-ads-client";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id")?.trim() || undefined;

  try {
    const result = await listXAdsAccounts(userId || null);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list X Ads accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}