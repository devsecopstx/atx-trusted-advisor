import { NextResponse } from "next/server";

import type { SessionUser } from "@/lib/auth";
import type { AdminPortfolioListScope } from "@/modules/core-admin/repository";
import { adminGetPortfolioById } from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

/** Break-glass: list/mutate all tenant portfolios (set in Secret Manager / env for support). */
export function isAdminPortfoliosListAllEnabled(): boolean {
  const v = process.env.ADMIN_PORTFOLIOS_LIST_ALL;
  if (v === undefined || v === null || v === "") {
    return false;
  }
  if (typeof v === "boolean") {
    return v;
  }
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function resolveAdminPortfolioListScope(session: SessionUser): AdminPortfolioListScope {
  if (isAdminPortfoliosListAllEnabled()) {
    return { mode: "all" };
  }
  return { mode: "scoped", userId: session.userId, tenantId: session.tenantId };
}

export function portfolioAccessibleToAdminSession(
  portfolio: Portfolio,
  session: SessionUser,
  listAll: boolean
): boolean {
  if (listAll) {
    return true;
  }
  const ownerHex = normalizeMongoUserIdHex(portfolio.userId);
  if (!ownerHex || ownerHex !== session.userId) {
    return false;
  }
  const pTenant = portfolio.tenantId?.toHexString();
  if (pTenant && pTenant !== session.tenantId) {
    return false;
  }
  return true;
}

/** Loads portfolio and enforces session scope (or break-glass). */
export async function requireAdminPortfolioForApi(
  portfolioId: string,
  session: SessionUser
): Promise<Portfolio | NextResponse> {
  const portfolio = await adminGetPortfolioById(portfolioId);
  if (!portfolio?._id) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }
  if (!portfolioAccessibleToAdminSession(portfolio, session, isAdminPortfoliosListAllEnabled())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return portfolio;
}
