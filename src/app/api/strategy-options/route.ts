import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyStrategyOptionsRequestToBackend, releaseUnusedProxyResponse } from "@/lib/backend-bff";
import { getStrategyOptionsChain } from "@/modules/strategy-options/options-chain";

export const dynamic = "force-dynamic";

/**
 * Option chain for xStrategyBuilder — aligned with xfinance-strategy `GET /api/options`.
 * Query: `underlying`, `expiration` (YYYY-MM-DD or Yahoo unix seconds), optional `strike` (anchor for synthetic fallback).
 *
 * When BFF proxy to Spring is on but the backend errors or omits this route, fall back to Next Yahoo chain.
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
  return getStrategyOptionsChain(request.url);
}
