import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { getPortfolioWatchlist } from "@/modules/core-admin/repository";

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

  return NextResponse.json({ data: watchlist });
}
