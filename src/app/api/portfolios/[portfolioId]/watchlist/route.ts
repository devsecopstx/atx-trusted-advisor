import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getPortfolioWatchlist } from "@/modules/core-admin/repository";
import { LOOKUP_ROUTE } from "@/modules/watchlist/yahoo-symbol-lookup";

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
  const watchlist = await getPortfolioWatchlist({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  // API-first default: skip external symbol lookup unless explicitly requested.
  const symbolsDetailed = (watchlist.symbols ?? []).map((item) => ({
    ...item,
    addedAt: item.addedAt.toISOString()
  }));

  return NextResponse.json({
    data: {
      ...watchlist,
      symbols: (watchlist.symbols ?? []).map((item) => ({
        ...item,
        addedAt: item.addedAt.toISOString()
      })),
      symbolsDetailed
    },
    metadata: {
      lookupRoute: LOOKUP_ROUTE,
      symbolLookupEnabled: false
    }
  });
}
