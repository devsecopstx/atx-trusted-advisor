import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import {
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts
} from "@/modules/core-admin/repository";

/**
 * Ensures the account exists under the user's portfolio (tenant-scoped).
 * Returns a NextResponse when the account is missing or not owned.
 */
export async function requireAccountInPortfolio(
  session: SessionUser,
  portfolioId: string,
  accountId: string
): Promise<NextResponse | null> {
  const portfolioIdNorm = normalizeMongoObjectIdParam(portfolioId);
  const accountIdNorm = normalizeMongoObjectIdParam(accountId);
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId: portfolioIdNorm,
    tenantId: session.tenantId
  });
  const match = accounts.some((a) => a._id?.toHexString() === accountIdNorm);
  if (!match) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return null;
}

/**
 * Ensures `portfolioId` is owned by the session user (tenant-scoped). Aligns with
 * xfinance-strategy `HasPortfolio` / portfolio boundary checks.
 */
export async function requirePortfolioForSessionUser(
  session: SessionUser,
  portfolioId: string
): Promise<NextResponse | null> {
  const pid = normalizeMongoObjectIdParam(portfolioId);
  if (!ObjectId.isValid(pid)) {
    return NextResponse.json({ error: "Invalid portfolio id" }, { status: 400 });
  }
  const portfolio = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId: pid
  });
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }
  return null;
}
