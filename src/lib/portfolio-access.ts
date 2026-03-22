import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import { listPortfolioAccounts } from "@/modules/core-admin/repository";

/**
 * Ensures the account exists under the user's portfolio (tenant-scoped).
 * Returns a NextResponse when the account is missing or not owned.
 */
export async function requireAccountInPortfolio(
  session: SessionUser,
  portfolioId: string,
  accountId: string
): Promise<NextResponse | null> {
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  const match = accounts.some((a) => a._id?.toHexString() === accountId);
  if (!match) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return null;
}
