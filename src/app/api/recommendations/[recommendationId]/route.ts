import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { recommendationToJson } from "@/lib/recommendations-json";
import { canUserLogin } from "@/modules/identity/authorization";
import { getRecommendationForUser } from "@/modules/recommendations/repository";

type RouteContext = { params: Promise<{ recommendationId: string }> };
const RECOMMENDATIONS_READ_POLICY = getBffRouteRateLimitPolicy("recommendations_read");

export async function GET(request: Request, context: RouteContext) {
  const { recommendationId } = await context.params;
  const limit = await checkDistributedRateLimit({
    key: `recommendations:read:${recommendationId}:${extractClientRateLimitKey(request)}`,
    windowMs: RECOMMENDATIONS_READ_POLICY.windowMs,
    max: RECOMMENDATIONS_READ_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Recommendation read rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await getRecommendationForUser({
    id: recommendationId,
    userId: session.userId,
    tenantId: session.tenantId
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: recommendationToJson(doc) });
}
