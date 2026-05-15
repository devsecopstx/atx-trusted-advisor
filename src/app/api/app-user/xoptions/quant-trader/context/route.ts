import { NextResponse } from "next/server";

import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { requireSessionUser } from "@/lib/auth";
import {
    mapDeskRiskProfileToMcTier,
    QUANT_TRADER_DEFAULT_PARAMS
} from "@/lib/xoptions/quant-trader-helpers";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import { getFindOptionsBootstrap } from "@/modules/find-options/find-options-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const book = await loadAppUserDefaultBook(session);
  const bootstrap = await getFindOptionsBootstrap(
    session,
    { holdingsLimit: 12, hotLimit: 5, accountId: book?.accountId ?? null },
    { coordinatingRequest: request }
  );
  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  const ctx = bootstrap.context;
  const deskRisk = ctx.account?.riskProfile ?? ctx.bookRiskProfile ?? null;
  const defaultRisk = mapDeskRiskProfileToMcTier(deskRisk);

  return NextResponse.json({
    data: {
      workspacePortfolioId: book?.portfolioId ?? null,
      workspacePortfolioName: book?.portfolioName ?? "Portfolio",
      ownedPortfolioCount: portfolios.length,
      deskRiskProfile: deskRisk,
      deskOutlook: ctx.account?.outlook ?? ctx.bookOutlook ?? null,
      hotWatchlistSymbols: bootstrap.hot.rows.map((row) => row.symbol),
      defaultParams: {
        ...QUANT_TRADER_DEFAULT_PARAMS,
        risk: defaultRisk
      }
    }
  });
}
