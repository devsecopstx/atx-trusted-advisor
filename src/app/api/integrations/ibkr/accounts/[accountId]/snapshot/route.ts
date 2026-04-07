import { NextResponse } from "next/server";

import {
    fetchIbkrAccountTrades,
    fetchIbkrLiveOrders,
    fetchIbkrPortfolioPositionsWithFallback,
    fetchIbkrPortfolioSummary,
    postIbkrSwitchAccount
} from "@/modules/ibkr-integration/client-portfolio-reads";
import { assertIbkrAccountAllowedForUser } from "@/modules/ibkr-integration/ibkr-account-allowlist";
import { logIbkrAudit } from "@/modules/ibkr-integration/ibkr-audit";
import { ibkrJsonResponse } from "@/modules/ibkr-integration/ibkr-correlation";
import { maskIbkrToken } from "@/modules/ibkr-integration/ibkr-mask";
import {
    ibkrUpstreamErrorResponse,
    requireIbkrReadContext
} from "@/modules/ibkr-integration/ibkr-read-route-context";

type Ctx = { params: Promise<{ accountId: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const base = await requireIbkrReadContext();
  if (base instanceof NextResponse) {
    return base;
  }
  const { correlationId } = base;
  const { accountId: raw } = await ctx.params;
  const accountId = decodeURIComponent(raw.trim());
  const acctMasked = maskIbkrToken(accountId);
  const url = new URL(request.url);
  const daysRaw = url.searchParams.get("days");
  const days = daysRaw ? Number(daysRaw) : 7;

  const allow = await assertIbkrAccountAllowedForUser({
    baseUrl: base.cfg.clientPortalBaseUrl!,
    cookieHeader: base.cookieHeader,
    accountId
  });
  if (!allow.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_snapshot_allowlist",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: allow.error,
      httpStatus: allow.httpStatus,
      sessionSource: base.resolvedSource
    });
    if (allow.error === "ibkr_account_not_in_portfolio") {
      return ibkrJsonResponse(correlationId, { error: allow.error }, { status: 403 });
    }
    if (allow.error === "invalid_account_id") {
      return ibkrJsonResponse(correlationId, { error: allow.error }, { status: 400 });
    }
    return ibkrUpstreamErrorResponse({ error: allow.error, httpStatus: allow.httpStatus }, correlationId);
  }

  const baseUrl = base.cfg.clientPortalBaseUrl!;
  const cookieHeader = base.cookieHeader;

  const summary = await fetchIbkrPortfolioSummary({ baseUrl, cookieHeader, accountId });
  if (!summary.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_snapshot",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: summary.error,
      httpStatus: summary.httpStatus,
      sessionSource: base.resolvedSource
    });
    return ibkrUpstreamErrorResponse(summary, correlationId);
  }

  const positions = await fetchIbkrPortfolioPositionsWithFallback({ baseUrl, cookieHeader, accountId });
  if (!positions.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_snapshot",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: positions.error,
      httpStatus: positions.httpStatus,
      sessionSource: base.resolvedSource
    });
    return ibkrUpstreamErrorResponse(positions, correlationId);
  }

  const switched = await postIbkrSwitchAccount({ baseUrl, cookieHeader, accountId });
  if (!switched.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_snapshot_switch",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: switched.error,
      httpStatus: switched.httpStatus,
      sessionSource: base.resolvedSource
    });
    if (switched.switchDeclined) {
      return ibkrJsonResponse(
        correlationId,
        {
          error: "ibkr_switch_account_declined",
          hint: "Could not select account for orders/trades in this CP session."
        },
        { status: 502 }
      );
    }
    return ibkrUpstreamErrorResponse(switched, correlationId);
  }

  const orders = await fetchIbkrLiveOrders({ baseUrl, cookieHeader });
  if (!orders.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_snapshot",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: orders.error,
      httpStatus: orders.httpStatus,
      sessionSource: base.resolvedSource
    });
    return ibkrUpstreamErrorResponse(orders, correlationId);
  }

  const trades = await fetchIbkrAccountTrades({
    baseUrl,
    cookieHeader,
    days: Number.isFinite(days) ? days : 7
  });
  if (!trades.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_snapshot",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: trades.error,
      httpStatus: trades.httpStatus,
      sessionSource: base.resolvedSource
    });
    return ibkrUpstreamErrorResponse(trades, correlationId);
  }

  const positionsSource = "source" in positions ? positions.source : null;
  const tradesDays = Math.min(7, Math.max(1, Math.floor(Number.isFinite(days) ? days : 7)));

  logIbkrAudit({
    correlationId,
    op: "portfolio_snapshot",
    userIdMasked: base.userIdMasked,
    accountIdMasked: acctMasked,
    ok: true,
    httpStatus: 200,
    sessionSource: base.resolvedSource
  });

  return ibkrJsonResponse(correlationId, {
    data: {
      accountId,
      summary: summary.data,
      positions: positions.data,
      positionsSource: positionsSource ?? null,
      orders: orders.data,
      executions: trades.data,
      executionsDays: tradesDays,
      paperTrading: base.cfg.paperTrading,
      sessionSource: base.resolvedSource
    }
  });
}
