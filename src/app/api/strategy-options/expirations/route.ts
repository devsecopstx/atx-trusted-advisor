import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyStrategyOptionsRequestToBackend, releaseUnusedProxyResponse } from "@/lib/backend-bff";
import { getStrategyOptionExpirations } from "@/modules/strategy-options/expirations";

export const dynamic = "force-dynamic";

/**
 * Expiration dates for an underlying — aligned with xfinance-strategy `GET /api/options/expirations`.
 * Query: `underlying` (required).
 *
 * When `ATXFINANCE_BACKEND_ORIGIN` is set we try Spring first; if the backend returns a non-2xx/3xx
 * (missing route, 5xx, etc.), fall back to the Next Yahoo path so xOptions works when JVM parity lags.
 */
export async function GET(request: Request) {
  const proxied = await proxyStrategyOptionsRequestToBackend(request);
  if (proxied?.ok) {
    return proxied;
  }
  if (proxied && !proxied.ok) {
    releaseUnusedProxyResponse(proxied);
  }
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  return getStrategyOptionExpirations(request.url);
}
