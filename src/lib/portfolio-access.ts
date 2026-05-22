import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { parseTenantObjectId } from "@/lib/mongo-tenant-scope";
import {
    getPortfolioAccountByIdForSessionUser,
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts
} from "@/modules/core-admin/repository";

function tenantScopeRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Tenant scope is required for this resource",
      code: "TENANT_SCOPE_REQUIRED"
    },
    { status: 403 }
  );
}

/** Sync guard for portfolio/positions data-plane routes (valid BSON tenant on session). */
export function requireTenantHexForPortfolioDataPlane(session: SessionUser): NextResponse | null {
  if (!parseTenantObjectId(session.tenantId)) {
    return tenantScopeRequiredResponse();
  }
  return null;
}

/**
 * Ensures the account exists under the user's portfolio (tenant-scoped).
 * Returns a NextResponse when the account is missing or not owned.
 */
export async function requireAccountInPortfolio(
  session: SessionUser,
  portfolioId: string,
  accountId: string
): Promise<NextResponse | null> {
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }
  const portfolioIdNorm = normalizeMongoObjectIdParam(portfolioId);
  const accountIdNorm = normalizeMongoObjectIdParam(accountId);
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId: portfolioIdNorm,
    tenantId: session.tenantId
  });
  if (accounts.some((a) => a._id?.toHexString() === accountIdNorm)) {
    return null;
  }
  const direct = await getPortfolioAccountByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    accountId: accountIdNorm
  });
  if (direct?._id && direct.portfolioId.toHexString() === portfolioIdNorm) {
    return null;
  }
  return NextResponse.json({ error: "Account not found" }, { status: 404 });
}

/**
 * Ensures `portfolioId` is owned by the session user (tenant-scoped). Aligns with
 * xfinance-strategy `HasPortfolio` / portfolio boundary checks.
 */
export async function requirePortfolioForSessionUser(
  session: SessionUser,
  portfolioId: string
): Promise<NextResponse | null> {
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }
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
