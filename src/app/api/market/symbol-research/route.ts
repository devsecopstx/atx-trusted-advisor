import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";
import { fetchSymbolResearch } from "@/modules/market/symbol-research";

/**
 * GET /api/market/symbol-research?symbol=RDW
 * Enriched delayed quote (bid/ask, ranges, volume) + symbol-scoped Yahoo news headlines.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }

  const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  if (!symbol || !/^[A-Z0-9.\-^]{1,15}$/.test(symbol)) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const data = await fetchSymbolResearch(symbol);
  if (!data) {
    return NextResponse.json({ error: "Quote unavailable for symbol" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
