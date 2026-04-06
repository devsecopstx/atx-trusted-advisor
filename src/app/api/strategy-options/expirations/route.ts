import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getStrategyOptionExpirations } from "@/modules/strategy-options/expirations";

export const dynamic = "force-dynamic";

/**
 * Expiration dates for an underlying — aligned with xfinance-strategy `GET /api/options/expirations`.
 * Query: `underlying` (required).
 *
 * **Always Next Yahoo** (no BFF proxy to Spring). Production used to proxy when `ATXFINANCE_BACKEND_ORIGIN`
 * was set; the JVM path has no client timeout and could stall the xOptions UI while local dev skipped
 * the proxy on loopback. `GET /api/strategy-options` (chain) may still proxy with sparse-chain fallback.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  return getStrategyOptionExpirations(request.url);
}
