import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { adminListPortfolioAlerts } from "@/modules/core-admin/repository";
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
