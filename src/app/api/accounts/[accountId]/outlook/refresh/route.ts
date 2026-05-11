import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { handlePortfolioAccountOutlookRefreshPost } from "@/lib/portfolio-account-outlook-refresh-post";
import { getPortfolioAccountByIdForSessionUser } from "@/modules/core-admin/repository";

/**
 * Account-centric alias for {@link handlePortfolioAccountOutlookRefreshPost} — resolves the owning
 * portfolio from the custodian account id (session-scoped).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { accountId } = await context.params;
  const account = await getPortfolioAccountByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    accountId
  });
  if (!account?._id || !account.portfolioId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return handlePortfolioAccountOutlookRefreshPost({
    request,
    session,
    portfolioId: account.portfolioId.toHexString(),
    accountId
  });
}
