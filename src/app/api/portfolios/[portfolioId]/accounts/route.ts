import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { requirePortfolioForSessionUser } from "@/lib/portfolio-access";
import {
    insertPortfolioAccountForUser,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { accountTypeValues, formatPositionUsd, normalizePositionType } from "@/modules/core-admin/types";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
  }>;
};

const postAccountSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(accountTypeValues).optional(),
  extAccountId: z.string().trim().min(1).max(200).optional(),
  cashBalance: z.number().finite().nonnegative().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const deniedGet = await requirePortfolioForSessionUser(session, portfolioId);
  if (deniedGet) {
    return deniedGet;
  }

  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (accounts.length === 0) {
    await provisionDefaultPortfolioForUser({
      userId: session.userId,
      tenantId: session.tenantId,
      watchlistSymbols: ["TSLA"]
    });
  }
  const refreshedAccounts =
    accounts.length > 0
      ? accounts
      : await listPortfolioAccounts({
          userId: session.userId,
          portfolioId,
          tenantId: session.tenantId
        });

  const accountIds = refreshedAccounts.flatMap((account) => (account._id ? [account._id] : []));
  const positions = await listPortfolioPositionsByAccount({
    userId: session.userId,
    portfolioId,
    accountIds,
    tenantId: session.tenantId
  });
  const positionsByAccountId = new Map<string, typeof positions>();
  for (const position of positions) {
    const key = position.accountId.toHexString();
    const existing = positionsByAccountId.get(key);
    if (existing) {
      existing.push(position);
      continue;
    }
    positionsByAccountId.set(key, [position]);
  }

  const shaped = refreshedAccounts.map((account) => {
    const accountId = account._id?.toHexString() ?? "";
    const accountPositions = positionsByAccountId.get(accountId) ?? [];
    return {
      _id: account._id?.toHexString(),
      name: account.name,
      accountRef: account.extAccountId,
      brokerType: account.type,
      balance: account.cashBalance ?? 25_000,
      riskLevel: "medium",
      strategy: "balanced",
      positions: accountPositions.map((position) => {
        const t = normalizePositionType(position.type);
        if (t === "cash") {
          return {
            _id: position._id?.toHexString(),
            type: t,
            label: position.symbol,
            amount: position.avgCost,
            amountFormatted: formatPositionUsd(position.avgCost)
          };
        }
        if (t === "option") {
          const exp = position.expiration;
          return {
            _id: position._id?.toHexString(),
            type: t,
            ticker: position.symbol,
            yahooRef: position.yahooRef ?? null,
            optionType: position.optionType ?? null,
            strike: position.strike ?? null,
            expiration: exp ? exp.toISOString().slice(0, 10) : null,
            contracts: position.qty,
            premiumPerContract: position.avgCost,
            shares: position.qty,
            purchasePrice: position.avgCost,
            currentPrice: position.avgCost
          };
        }
        return {
          _id: position._id?.toHexString(),
          type: t,
          ticker: position.symbol,
          shares: position.qty,
          purchasePrice: position.avgCost,
          currentPrice: position.avgCost
        };
      }),
      recommendations: [],
      // Legacy fields kept for existing admin client compatibility.
      userId: account.userId,
      portfolioId: account.portfolioId.toHexString(),
      type: account.type,
      extAccountId: account.extAccountId,
      isDefault: account.isDefault,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  });

  return NextResponse.json({ data: shaped });
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const denied = await requirePortfolioForSessionUser(session, portfolioId);
  if (denied) {
    return denied;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postAccountSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await insertPortfolioAccountForUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId,
    name: parsed.data.name,
    type: parsed.data.type,
    extAccountId: parsed.data.extAccountId,
    cashBalance: parsed.data.cashBalance
  });
  if (!created?._id) {
    return NextResponse.json({ error: "Could not create account" }, { status: 400 });
  }

  const row = {
    _id: created._id.toHexString(),
    name: created.name,
    accountRef: created.extAccountId,
    brokerType: created.type,
    balance: created.cashBalance ?? 25_000,
    riskLevel: "medium" as const,
    strategy: "balanced" as const,
    positions: [] as unknown[],
    recommendations: [] as unknown[],
    userId: created.userId,
    portfolioId: created.portfolioId.toHexString(),
    type: created.type,
    extAccountId: created.extAccountId,
    isDefault: created.isDefault,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString()
  };

  return NextResponse.json({ data: row }, { status: 201 });
}
