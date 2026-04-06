import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import { getEffectiveWorkspaceLimitsForUser } from "@/lib/tenant-workspace-limits";
import {
    adminInsertAccountForPortfolio,
    adminListAccountsForPortfolio,
    countPortfolioAccountsForUser,
    DEFAULT_ACCOUNT_CASH_BALANCE
} from "@/modules/core-admin/repository";
import type { Account } from "@/modules/core-admin/types";
import { accountTypeValues, parseAccountOutlook } from "@/modules/core-admin/types";
import {
    formatCoreUserDisplayName,
    getCoreUsersByIds,
    normalizeMongoUserIdHex
} from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

function serializeAccount(a: Account) {
  return {
    _id: a._id!.toHexString(),
    tenantId: a.tenantId?.toHexString(),
    userId: a.userId,
    portfolioId: a.portfolioId.toHexString(),
    name: a.name,
    type: a.type,
    extAccountId: a.extAccountId,
    cashBalance:
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance)
        ? a.cashBalance
        : DEFAULT_ACCOUNT_CASH_BALANCE,
    isDefault: a.isDefault,
    riskProfile: a.riskProfile ?? null,
    outlook: parseAccountOutlook(a.outlook),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString()
  };
}

const postSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(accountTypeValues).optional(),
  extAccountId: z.string().trim().min(1).max(200).optional(),
  cashBalance: z.number().finite().nonnegative().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const portfolio = await requireAdminPortfolioForApi(portfolioId, session);
  if (portfolio instanceof NextResponse) {
    return portfolio;
  }

  const accounts = await adminListAccountsForPortfolio(portfolioId);
  const accountCount = accounts.length;
  const totalCashBalance = accounts.reduce((sum, a) => {
    const b =
      typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance)
        ? a.cashBalance
        : DEFAULT_ACCOUNT_CASH_BALANCE;
    return sum + b;
  }, 0);

  const ownerHex = normalizeMongoUserIdHex(portfolio.userId);
  const ownerMap = ownerHex ? await getCoreUsersByIds([ownerHex]) : new Map();
  const owner = ownerHex ? ownerMap.get(ownerHex) : undefined;

  return NextResponse.json({
    data: {
      portfolio: {
        _id: portfolio._id!.toHexString(),
        name: portfolio.name,
        userId: ownerHex ?? "",
        tenantPortfolioOrgKey: portfolio.tenantPortfolioOrgKey,
        userDisplayName: formatCoreUserDisplayName(owner),
        userEmail: owner?.email ?? null
      },
      accountCount,
      totalCashBalance,
      accounts: accounts.map(serializeAccount)
    }
  });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyAdminUsersRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const portfolioRow = await requireAdminPortfolioForApi(portfolioId, session);
  if (portfolioRow instanceof NextResponse) {
    return portfolioRow;
  }
  const ownerId = normalizeMongoUserIdHex(portfolioRow.userId) ?? "";
  const tenantHex = portfolioRow.tenantId?.toHexString() ?? "";

  const created = await adminInsertAccountForPortfolio({
    portfolioId,
    name: parsed.data.name,
    type: parsed.data.type,
    extAccountId: parsed.data.extAccountId,
    cashBalance: parsed.data.cashBalance
  });
  if (!created?._id) {
    const limits = await getEffectiveWorkspaceLimitsForUser({
      tenantId: tenantHex,
      userId: ownerId
    });
    const n = await countPortfolioAccountsForUser({
      userId: ownerId,
      portfolioId,
      tenantId: tenantHex || undefined
    });
    if (n >= limits.portfolioAccountLimit) {
      return NextResponse.json(
        {
          error: `Account limit reached for this portfolio (max ${limits.portfolioAccountLimit}). Raise workspace limits under Admin → Tenant workspace.`,
          code: "workspace_portfolio_account_limit_exceeded"
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Could not create account" }, { status: 400 });
  }

  return NextResponse.json({ data: serializeAccount(created) }, { status: 201 });
}
