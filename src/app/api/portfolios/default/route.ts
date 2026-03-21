import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import {
    getDefaultPortfolio,
    listPortfolioAccounts,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

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
  const refreshedAccounts =
    accounts.length > 0
      ? accounts
      : await listPortfolioAccounts({
          userId: session.userId,
          portfolioId: portfolio._id.toHexString(),
          tenantId: session.tenantId
        });

  return NextResponse.json({
    data: {
      _id: portfolio._id.toHexString(),
      name: portfolio.name,
      accounts: refreshedAccounts.map((account) => ({
        _id: account._id?.toHexString(),
        name: account.name,
        accountRef: account.extAccountId,
        brokerType: account.type,
        balance: account.cashBalance ?? 25_000,
        riskLevel: "medium",
        strategy: "balanced",
        positions: [],
        recommendations: []
      })),
      totalValue: 0,
      dailyChange: 0,
      dailyChangePercent: 0,
      // Legacy compatibility fields.
      userId: portfolio.userId,
      isDefault: portfolio.isDefault,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString()
    }
  });
}
