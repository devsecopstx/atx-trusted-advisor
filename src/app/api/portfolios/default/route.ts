import { NextResponse } from "next/server";

import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
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

  const data = await buildPortfolioSummaryPayload(session, portfolio);
  return NextResponse.json({ data });
}
