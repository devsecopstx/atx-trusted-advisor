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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ positionId: string }> }
) {
  const { positionId } = await context.params;

  // Proxy to Spring backend when the BFF gate is active (ATXFINANCE_BACKEND_ORIGIN + policy).
  // User position saves (PATCH for "change existing holding" in the portfolio holdings editor)
  // are now handled by the backend Spring API (`PositionsController.patch` + `PositionsService.patch`).
  // Only falls back to the local Mongo path when the proxy gate is off (typical `next dev` without
  // explicit loopback override, or no backend configured).
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  // Local Mongo fallback (only used when BFF proxy is disabled for this request — typical for plain `next dev`)
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

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // empty body is ok for some updates
  }

  // Minimal local support: update qty / avgCost on the position document
  const { qty, avgCost, symbol } = body;

  const update: Record<string, any> = {};
  if (typeof qty === "number" && Number.isFinite(qty)) update.qty = qty;
  if (typeof avgCost === "number" && Number.isFinite(avgCost)) update.avgCost = avgCost;
  if (typeof symbol === "string" && symbol.trim()) update.symbol = symbol.trim().toUpperCase();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const { getDb } = await import("@/lib/mongodb");
  const db = await getDb();
  const { ObjectId } = await import("mongodb");

  const result = await db.collection("portfolio_positions").updateOne(
    {
      _id: new ObjectId(positionId),
      portfolioId: new ObjectId(portfolioId),
      accountId: new ObjectId(accountId),
      userId: new ObjectId(session.userId)
    },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
