import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyStrategyOptionsRequestToBackend, releaseUnusedProxyResponse } from "@/lib/backend-bff";
import { shouldTrustSpringStrategyOptionsPayload } from "@/lib/strategy-options-spring-proxy-fallback";
import { getStrategyOptionsChain } from "@/modules/strategy-options/options-chain";

export const dynamic = "force-dynamic";

/**
 * Option chain for xStrategyBuilder — aligned with xfinance-strategy `GET /api/options`.
 * Query: `underlying`, `expiration` (YYYY-MM-DD or Yahoo unix seconds), optional `strike` (anchor for synthetic fallback).
 *
 * When BFF proxy to Spring is on: use Spring only if the JSON has a full enough `optionChain`; otherwise
 * fall back to Next Yahoo (same as error path) so staging matches local strike coverage when JVM lags.
 */
export async function GET(request: Request) {
  const proxied = await proxyStrategyOptionsRequestToBackend(request);
  if (proxied?.ok) {
    try {
      const data = await proxied.clone().json();
      if (shouldTrustSpringStrategyOptionsPayload(data)) {
        return proxied;
      }
      console.warn(
        "[strategy-options] Spring proxy returned sparse chain; falling back to Next Yahoo handler"
      );
    } catch {
      console.warn("[strategy-options] Spring proxy returned non-JSON ok; falling back to Next Yahoo");
    }
    releaseUnusedProxyResponse(proxied);
  } else if (proxied && !proxied.ok) {
    releaseUnusedProxyResponse(proxied);
  }
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  return getStrategyOptionsChain(request.url);
}
