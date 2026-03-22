import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth";
import { caughtErrorMessage } from "@/lib/caught-error";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import {
  getDefaultPortfolio,
  listPortfolioAccounts,
  provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";

type SummaryResult =
  | NextResponse
  | { data: Awaited<ReturnType<typeof buildPortfolioSummaryPayload>> };

async function defaultPortfolioSummaryOrError(session: SessionUser): Promise<SummaryResult> {
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

export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const result = await defaultPortfolioSummaryOrError(session);
  if (result instanceof NextResponse) {
    return result;
  }
  return NextResponse.json({ data: result.data });
}

export async function POST() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const result = await defaultPortfolioSummaryOrError(session);
    if (result instanceof NextResponse) {
      return result;
    }
    return NextResponse.json({ data: result.data, synced: true as const });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(`[api/portfolios/default POST] ${detail}`);
    return NextResponse.json(
      { error: "Could not sync your default portfolio. Please try again in a moment." },
      { status: 500 }
    );
  }
}
