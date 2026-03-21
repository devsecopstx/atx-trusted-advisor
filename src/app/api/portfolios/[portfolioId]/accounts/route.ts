import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import {
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
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
          portfolioId,
          tenantId: session.tenantId
        });

  const accountIds = refreshedAccounts.flatMap((account) => (account._id ? [account._id] : []));
  const positions = await listPortfolioPositionsByAccount({
    userId: session.userId,
    portfolioId,
    accountIds,
    tenantId: session.tenantId
  });
  const positionsByAccountId = new Map<string, typeof positions>();
  for (const position of positions) {
    const key = position.accountId.toHexString();
    const existing = positionsByAccountId.get(key);
    if (existing) {
      existing.push(position);
      continue;
    }
    positionsByAccountId.set(key, [position]);
  }

  const shaped = refreshedAccounts.map((account) => {
    const accountId = account._id?.toHexString() ?? "";
    const accountPositions = positionsByAccountId.get(accountId) ?? [];
    return {
      _id: account._id?.toHexString(),
      name: account.name,
      accountRef: account.extAccountId,
      brokerType: account.type,
      balance: account.cashBalance ?? 25_000,
      riskLevel: "medium",
      strategy: "balanced",
      positions: accountPositions.map((position) => ({
        _id: position._id?.toHexString(),
        type: "stock",
        ticker: position.symbol,
        shares: position.qty,
        purchasePrice: position.avgCost,
        currentPrice: position.avgCost
      })),
      recommendations: [],
      // Legacy fields kept for existing admin client compatibility.
      userId: account.userId,
      portfolioId: account.portfolioId.toHexString(),
      type: account.type,
      extAccountId: account.extAccountId,
      isDefault: account.isDefault,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  });

  return NextResponse.json({ data: shaped });
}
