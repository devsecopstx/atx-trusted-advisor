import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getPortfolioByIdForSessionUser } from "@/modules/core-admin/repository";
import { hasActiveAppBrokerImportForPortfolio } from "@/modules/portfolio-import/app-broker-import-job";
import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

const MAX_SYMBOLS = 28;

function parseSymbols(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const parts = raw.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  return [...new Set(parts)].slice(0, MAX_SYMBOLS);
}

/**
 * Signed-in users: batch Yahoo quotes + logos for portfolio / holdings UI.
 * Same lookup path as watchlist `?quotes=1` (shared cache in `lookupSymbols`).
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  if (symbols.length === 0) {
    return NextResponse.json({ data: {} as Record<string, SymbolLookupResult | null> });
  }

  const portfolioIdParam = searchParams.get("portfolioId")?.trim() ?? "";
  if (portfolioIdParam) {
    const book = await getPortfolioByIdForSessionUser({
      userId: session.userId,
      tenantId: session.tenantId,
      portfolioId: portfolioIdParam
    });
    if (book?._id) {
      const importRunning = await hasActiveAppBrokerImportForPortfolio({
        portfolioIdHex: portfolioIdParam,
        userId: session.userId,
        tenantId: session.tenantId
      });
      if (importRunning) {
        const empty: Record<string, SymbolLookupResult | null> = {};
        for (const sym of symbols) {
          empty[sym] = null;
        }
        return NextResponse.json({
          data: empty,
          brokerImportSuspended: true
        });
      }
    }
  }

  const map = await lookupSymbols(symbols);
  const data: Record<string, SymbolLookupResult | null> = {};
  for (const sym of symbols) {
    data[sym] = map.get(sym) ?? null;
  }

  return NextResponse.json({ data });
}
