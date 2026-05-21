import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { collectAdminHubSummary } from "@/modules/admin/admin-hub-summary";

export async function GET() {
  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const body = await collectAdminHubSummary(session);
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" }
  });
}
