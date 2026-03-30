import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { getTopStockHoldingsByValue } from "@/modules/find-options/find-options-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("limit");
  const limit = raw ? parseInt(raw, 10) : 10;
  const safe = Number.isFinite(limit) ? limit : 10;

  const { holdings } = await getTopStockHoldingsByValue(session, safe);
  return NextResponse.json({ data: { holdings } });
}
