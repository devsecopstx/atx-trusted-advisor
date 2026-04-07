import { NextResponse } from "next/server";

import { fetchIbkrPortfolioAccounts } from "@/modules/ibkr-integration/client-portfolio";
import { logIbkrAudit } from "@/modules/ibkr-integration/ibkr-audit";
import { ibkrJsonResponse } from "@/modules/ibkr-integration/ibkr-correlation";
import {
    ibkrUpstreamErrorResponse,
    requireIbkrReadContext
} from "@/modules/ibkr-integration/ibkr-read-route-context";

export async function GET() {
  const base = await requireIbkrReadContext();
  if (base instanceof NextResponse) {
    return base;
  }

  const { correlationId } = base;

  const result = await fetchIbkrPortfolioAccounts({
    baseUrl: base.cfg.clientPortalBaseUrl!,
    cookieHeader: base.cookieHeader
  });

  if (!result.ok) {
    logIbkrAudit({
      correlationId,
      op: "portfolio_accounts",
      userIdMasked: base.userIdMasked,
      ok: false,
      detail: result.error,
      httpStatus: result.httpStatus,
      sessionSource: base.resolvedSource
    });
    if (result.httpStatus === 401 || result.httpStatus === 403) {
      return ibkrUpstreamErrorResponse(
        { error: "upstream_auth", httpStatus: result.httpStatus },
        correlationId
      );
    }
    return ibkrJsonResponse(
      correlationId,
      {
        error: "ibkr_upstream_error",
        detail: result.error,
        httpStatus: result.httpStatus ?? null
      },
      { status: 502 }
    );
  }

  logIbkrAudit({
    correlationId,
    op: "portfolio_accounts",
    userIdMasked: base.userIdMasked,
    ok: true,
    httpStatus: result.httpStatus,
    sessionSource: base.resolvedSource
  });

  return ibkrJsonResponse(correlationId, {
    data: {
      accounts: result.accounts,
      paperTrading: base.cfg.paperTrading,
      sessionSource: base.resolvedSource
    }
  });
}
