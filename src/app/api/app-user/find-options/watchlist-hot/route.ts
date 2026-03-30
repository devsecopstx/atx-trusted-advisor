import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { getHotWatchlistSymbols } from "@/modules/find-options/find-options-service";

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
  const limit = raw ? parseInt(raw, 10) : 3;
  const safe = Number.isFinite(limit) ? limit : 3;

  const { rows, scanned } = await getHotWatchlistSymbols(session, safe);
  return NextResponse.json({ data: { rows, scanned } });
}
