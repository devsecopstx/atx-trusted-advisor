import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { adminListPortfolioAlerts, deleteAllPortfolioAlertsForPortfolio } from "@/modules/core-admin/repository";
import type { PortfolioAlert } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializeAlert(a: PortfolioAlert) {
  return {
    _id: a._id!.toHexString(),
    title: a.title,
    body: a.body ?? null,
    severity: a.severity,
    status: a.status,
    symbol: a.symbol ?? null,
    portfolioId: a.portfolioId.toHexString(),
    portfolioName: a.portfolioName ?? null,
    accountId: a.accountId?.toHexString() ?? null,
    accountName: a.accountName ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(_request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const rows = await adminListPortfolioAlerts(portfolioId);
  return NextResponse.json({ data: rows.map(serializeAlert) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(_request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  const deleted = await deleteAllPortfolioAlertsForPortfolio(portfolioId);
  return NextResponse.json({ deleted });
}
