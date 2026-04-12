import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminPortfolioForApi } from "@/lib/admin-portfolio-access";
import { requireAdminSession } from "@/lib/api-auth";
import { proxyAdminUsersRequestToBackend } from "@/lib/backend-bff";
import {
    adminEnsurePortfolioWatchlist,
    getPortfolioWatchlist,
    mutatePortfolioWatchlistSymbols
} from "@/modules/core-admin/repository";
import {
    accountOutlookValues,
    parseAccountOutlook,
    type Portfolio,
    type Watchlist,
    type WatchlistSymbol
} from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ portfolioId: string }>;
};

const watchlistAddEntrySchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  lineType: z.union([z.string().trim().max(128), z.null()]).optional(),
  strategy: z.union([z.string().trim().max(512), z.null()]).optional(),
  quantity: z.union([z.number().finite(), z.null()]).optional(),
  entryPrice: z.union([z.number().finite(), z.null()]).optional(),
  rationale: z.union([z.string().trim().max(4000), z.null()]).optional(),
  rowStatus: z.union([z.enum(["draft", "active", "review"]), z.null()]).optional()
});

const deskRiskEnum = z.enum(["conservative", "balanced", "growth"]);
const deskOutlookEnum = z.enum(accountOutlookValues);

const patchBodySchema = z
  .object({
    addSymbols: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    addEntries: z.array(watchlistAddEntrySchema).max(20).optional(),
    removeSymbols: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    dedupe: z.boolean().optional(),
    riskProfile: z.union([deskRiskEnum, z.null()]).optional(),
    outlook: z.union([deskOutlookEnum, z.null()]).optional()
  })
  .refine(
    (data) =>
      Boolean(data.addSymbols?.length) ||
      Boolean(data.addEntries?.length) ||
      Boolean(data.removeSymbols?.length) ||
      data.dedupe === true ||
      data.riskProfile !== undefined ||
      data.outlook !== undefined,
    {
      message:
        "Provide addSymbols, addEntries, removeSymbols, dedupe: true, riskProfile, or outlook"
    }
  );

function watchlistSymbolToJsonRow(item: WatchlistSymbol) {
  return {
    symbol: item.symbol,
    addedAt: item.addedAt.toISOString(),
    ...(item.lineType !== undefined ? { lineType: item.lineType } : {}),
    ...(item.strategy !== undefined ? { strategy: item.strategy } : {}),
    ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
    ...(item.entryPrice !== undefined ? { entryPrice: item.entryPrice } : {}),
    ...(item.rationale !== undefined ? { rationale: item.rationale } : {}),
    ...(item.rowStatus !== undefined ? { rowStatus: item.rowStatus } : {}),
    ...(item.lastPrice !== undefined ? { lastPrice: item.lastPrice } : {}),
    ...(item.lastUpdatedAt ? { lastUpdatedAt: item.lastUpdatedAt.toISOString() } : {})
  };
}

function portfolioTenantIdStringFromPortfolio(p: Portfolio): string | undefined {
  if (!p._id) return undefined;
  return p.tenantId?.toHexString();
}

function serializeWatchlistPayload(watchlist: Watchlist, portfolioIdForApi: string) {
  return {
    data: {
      _id: watchlist._id?.toHexString(),
      userId: watchlist.userId,
      portfolioId: portfolioIdForApi,
      name: watchlist.name,
      isDefault: watchlist.isDefault,
      riskProfile: watchlist.riskProfile ?? null,
      outlook: parseAccountOutlook(watchlist.outlook),
      symbols: (watchlist.symbols ?? []).map(watchlistSymbolToJsonRow),
      createdAt: watchlist.createdAt.toISOString(),
      updatedAt: watchlist.updatedAt.toISOString()
    }
  };
}

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

  const ownerUserId = normalizeMongoUserIdHex(portfolio.userId) ?? "";
  let watchlist = await getPortfolioWatchlist({
    userId: ownerUserId,
    portfolioId,
    tenantId: portfolioTenantIdStringFromPortfolio(portfolio)
  });
  if (!watchlist) {
    watchlist = await adminEnsurePortfolioWatchlist(portfolioId);
  }
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  return NextResponse.json(serializeWatchlistPayload(watchlist, portfolioId));
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const tenantId = portfolioTenantIdStringFromPortfolio(portfolio);
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ownerUserId = normalizeMongoUserIdHex(portfolio.userId) ?? "";
  let ensured = await getPortfolioWatchlist({
    userId: ownerUserId,
    portfolioId,
    tenantId
  });
  if (!ensured) {
    ensured = await adminEnsurePortfolioWatchlist(portfolioId);
  }
  if (!ensured) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const addEntries = parsed.data.addEntries;
  if (addEntries?.length) {
    for (const e of addEntries) {
      if (e.rowStatus === "active") {
        const r = e.rationale?.trim() ?? "";
        if (r.length === 0) {
          return NextResponse.json(
            { error: "Active rows require a saved rationale (non-empty)." },
            { status: 400 }
          );
        }
      }
    }
  }

  const updated = await mutatePortfolioWatchlistSymbols({
    userId: ownerUserId,
    portfolioId,
    tenantId,
    addSymbols: parsed.data.addSymbols,
    addEntries: parsed.data.addEntries,
    removeSymbols: parsed.data.removeSymbols,
    dedupe: parsed.data.dedupe,
    riskProfile: parsed.data.riskProfile,
    outlook: parsed.data.outlook
  });

  if (!updated) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  return NextResponse.json(serializeWatchlistPayload(updated, portfolioId));
}
