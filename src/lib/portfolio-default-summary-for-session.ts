import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import {
  getDefaultPortfolio,
  listPortfolioAccounts,
  provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";

export type DefaultPortfolioSummaryResult =
  | NextResponse
  | { data: Awaited<ReturnType<typeof buildPortfolioSummaryPayload>> };

/**
 * Default book summary for app-user session — shared by `GET /api/portfolios/default` and read facades.
 */
export async function loadDefaultPortfolioSummaryForSession(session: SessionUser): Promise<DefaultPortfolioSummaryResult> {
  let portfolio = await getDefaultPortfolio(session.userId, {
    tenantId: session.tenantId
  });
  if (!portfolio?._id) {
    const provisioned = await provisionDefaultPortfolioForUser({
      userId: session.userId,
      tenantId: session.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    portfolio = provisioned.portfolio;
  }
  if (!portfolio) {
    return NextResponse.json({ error: "Default portfolio not found" }, { status: 404 });
  }
  if (!portfolio._id) {
    return NextResponse.json({ error: "Default portfolio missing id" }, { status: 500 });
  }

  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId: portfolio._id.toHexString(),
    tenantId: session.tenantId
  });
  if (accounts.length === 0) {
    await provisionDefaultPortfolioForUser({
      userId: session.userId,
      tenantId: session.tenantId,
      watchlistSymbols: ["TSLA"]
    });
  }

  const data = await buildPortfolioSummaryPayload(session, portfolio);
  return { data };
}
