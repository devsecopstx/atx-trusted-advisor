import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { requireAccountInPortfolio } from "@/lib/portfolio-access";
import { handlePortfolioAccountOutlookRefreshPost } from "@/lib/portfolio-account-outlook-refresh-post";

export async function POST(
  request: Request,
  context: { params: Promise<{ portfolioId: string; accountId: string }> }
) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId, accountId } = await context.params;
  const denied = await requireAccountInPortfolio(session, portfolioId, accountId);
  if (denied) {
    return denied;
  }

  return handlePortfolioAccountOutlookRefreshPost({
    request,
    session,
    portfolioId,
    accountId
  });
}
