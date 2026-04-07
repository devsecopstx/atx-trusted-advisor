import { NextResponse } from "next/server";

import { fetchIbkrLiveOrders, postIbkrSwitchAccount } from "@/modules/ibkr-integration/client-portfolio-reads";
import { assertIbkrAccountAllowedForUser } from "@/modules/ibkr-integration/ibkr-account-allowlist";
import { logIbkrAudit } from "@/modules/ibkr-integration/ibkr-audit";
import { ibkrJsonResponse } from "@/modules/ibkr-integration/ibkr-correlation";
import { maskIbkrToken } from "@/modules/ibkr-integration/ibkr-mask";
import {
    ibkrUpstreamErrorResponse,
    requireIbkrReadContext
} from "@/modules/ibkr-integration/ibkr-read-route-context";

type Ctx = { params: Promise<{ accountId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const base = await requireIbkrReadContext();
  if (base instanceof NextResponse) {
    return base;
  }
  const { correlationId } = base;
  const { accountId: raw } = await ctx.params;
  const accountId = decodeURIComponent(raw.trim());
  const acctMasked = maskIbkrToken(accountId);

  const allow = await assertIbkrAccountAllowedForUser({
    baseUrl: base.cfg.clientPortalBaseUrl!,
    cookieHeader: base.cookieHeader,
    accountId
  });
  if (!allow.ok) {
    logIbkrAudit({
      correlationId,
      op: "iserver_orders_allowlist",
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

  const switched = await postIbkrSwitchAccount({
    baseUrl: base.cfg.clientPortalBaseUrl!,
    cookieHeader: base.cookieHeader,
    accountId
  });
  if (!switched.ok) {
    logIbkrAudit({
      correlationId,
      op: "iserver_switch_account",
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
          hint: "Client Portal did not switch accounts (common for single-account logins). Try again or confirm account id matches IBKR."
        },
        { status: 502 }
      );
    }
    return ibkrUpstreamErrorResponse(switched, correlationId);
  }

  const result = await fetchIbkrLiveOrders({
    baseUrl: base.cfg.clientPortalBaseUrl!,
    cookieHeader: base.cookieHeader
  });

  if (!result.ok) {
    logIbkrAudit({
      correlationId,
      op: "iserver_orders",
      userIdMasked: base.userIdMasked,
      accountIdMasked: acctMasked,
      ok: false,
      detail: result.error,
      httpStatus: result.httpStatus,
      sessionSource: base.resolvedSource
    });
    return ibkrUpstreamErrorResponse(result, correlationId);
  }

  logIbkrAudit({
    correlationId,
    op: "iserver_orders",
    userIdMasked: base.userIdMasked,
    accountIdMasked: acctMasked,
    ok: true,
    httpStatus: result.httpStatus,
    sessionSource: base.resolvedSource
  });

  return ibkrJsonResponse(correlationId, {
    data: {
      accountId,
      orders: result.data,
      paperTrading: base.cfg.paperTrading,
      sessionSource: base.resolvedSource
    }
  });
}
