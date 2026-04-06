import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import {
    buildRateLimitHeaders,
    checkDistributedRateLimit,
    extractClientRateLimitKey,
    getBffRouteRateLimitPolicy
} from "@/lib/distributed-rate-limit";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import { deletePositionForAccount } from "@/modules/core-admin/repository";

const POSITIONS_DELETE_POLICY = getBffRouteRateLimitPolicy("positions_delete");

export async function DELETE(
  request: Request,
  context: { params: Promise<{ positionId: string }> }
) {
  const { positionId } = await context.params;
  const limit = await checkDistributedRateLimit({
    key: `positions:delete:${positionId}:${extractClientRateLimitKey(request)}`,
    windowMs: POSITIONS_DELETE_POLICY.windowMs,
    max: POSITIONS_DELETE_POLICY.max
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Positions delete rate limit exceeded. Please retry shortly.",
        retryAfterSeconds: limit.retryAfterSeconds
      },
      { status: 429, headers: buildRateLimitHeaders(limit) }
    );
  }
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const portfolioId = normalizeMongoObjectIdParam(url.searchParams.get("portfolioId") ?? "");
  const accountId = normalizeMongoObjectIdParam(url.searchParams.get("accountId") ?? "");

  if (!portfolioId || !accountId) {
    return NextResponse.json(
      { error: "Query parameters portfolioId and accountId are required" },
      { status: 400 }
    );
  }

  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  const deleted = await deletePositionForAccount({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    accountId,
    positionId
  });

  if (!deleted) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
