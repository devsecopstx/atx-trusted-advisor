import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { getStrategyOptionExpirations } from "@/modules/strategy-options/expirations";

export const dynamic = "force-dynamic";

/**
 * Expiration dates for an underlying — aligned with xfinance-strategy `GET /api/options/expirations`.
 * Query: `underlying` (required).
 */
export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  return getStrategyOptionExpirations(request.url);
}
