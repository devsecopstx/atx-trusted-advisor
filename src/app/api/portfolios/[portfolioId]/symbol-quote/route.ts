import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import { getPortfolioWatchlist } from "@/modules/core-admin/repository";
import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function normalizeSym(s: string): string {
  return s.trim().toUpperCase();
}

export async function GET(request: Request, context: RouteContext) {
  const sessionOrRes = await requireSessionUser();
  if (sessionOrRes instanceof NextResponse) {
    return sessionOrRes;
  }
  const session = sessionOrRes;

  const { portfolioId } = await context.params;
  const gate = await requirePortfolioForSessionUser(session, portfolioId);
  if (gate) {
    return gate;
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("symbol") ?? "";
  const symbol = normalizeSym(raw);
  if (symbol.length < 1 || symbol.length > 32) {
    return NextResponse.json({ error: "symbol query required (1–32 chars)" }, { status: 400 });
  }

  const watchlist = await getPortfolioWatchlist({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });

  const wlRow = (watchlist?.symbols ?? []).find((s) => normalizeSym(s.symbol) === symbol);

  let quote: SymbolLookupResult | null = null;
  try {
    const map = await lookupSymbols([symbol]);
    quote = map.get(symbol) ?? null;
  } catch {
    quote = null;
  }

  const liveOrStale =
    quote?.price != null && Number.isFinite(quote.price)
      ? quote.price
      : wlRow?.lastPrice != null && Number.isFinite(wlRow.lastPrice)
        ? wlRow.lastPrice
        : null;

  const suggestedPurchasePrice =
    wlRow?.entryPrice != null && Number.isFinite(wlRow.entryPrice)
      ? wlRow.entryPrice
      : liveOrStale;

  return NextResponse.json({
    data: {
      symbol,
      quote,
      fromWatchlist: Boolean(wlRow),
      watchlistEntry:
        wlRow != null
          ? {
              entryPrice: wlRow.entryPrice ?? null,
              quantity: wlRow.quantity ?? null,
              lineType: wlRow.lineType ?? null
            }
          : null,
      suggestedPurchasePrice
    }
  });
}
