import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { requireTenantHexForPortfolioDataPlane } from "@/lib/portfolio-access";
import {
    ensureUserWatchlistForSessionUser,
    mutateUserWatchlistSymbols
} from "@/modules/core-admin/repository";
import {
    accountOutlookValues,
    type Watchlist,
    type WatchlistSymbol
} from "@/modules/core-admin/types";
import {
    LOOKUP_ROUTE,
    lookupSymbols,
    type SymbolLookupResult
} from "@/modules/watchlist/yahoo-symbol-lookup";
import { isExpiredCallOption } from "@/modules/watchlist/option-expiration";

const watchlistAddEntrySchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  lineType: z.union([z.string().trim().max(128), z.null()]).optional(),
  strategy: z.union([z.string().trim().max(512), z.null()]).optional(),
  quantity: z.union([z.number().finite(), z.null()]).optional(),
  entryPrice: z.union([z.number().finite(), z.null()]).optional(),
  priceAlertMinAbsMovePercent: z.union([z.number().min(0.1).max(100), z.null()]).optional()
});

const deskRiskEnum = z.enum(["conservative", "balanced", "growth"]);
const deskOutlookEnum = z.enum(accountOutlookValues);

const patchBodySchema = z
  .object({
    name: z.string().trim().min(1).max(128).optional(),
    addSymbols: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    addEntries: z.array(watchlistAddEntrySchema).max(20).optional(),
    removeSymbols: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    dedupe: z.boolean().optional(),
    riskProfile: z.union([deskRiskEnum, z.null()]).optional(),
    outlook: z.union([deskOutlookEnum, z.null()]).optional()
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      Boolean(data.addSymbols?.length) ||
      Boolean(data.addEntries?.length) ||
      Boolean(data.removeSymbols?.length) ||
      data.dedupe === true ||
      data.riskProfile !== undefined ||
      data.outlook !== undefined,
    {
      message:
        "Provide name, addSymbols, addEntries, removeSymbols, dedupe: true, riskProfile, or outlook"
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
    ...(item.priceAlertMinAbsMovePercent !== undefined
      ? { priceAlertMinAbsMovePercent: item.priceAlertMinAbsMovePercent }
      : {}),
    ...(item.lastPrice !== undefined ? { lastPrice: item.lastPrice } : {}),
    ...(item.lastUpdatedAt ? { lastUpdatedAt: item.lastUpdatedAt.toISOString() } : {})
  };
}

function toIsoSymbolRows(watchlist: Watchlist) {
  return (watchlist.symbols ?? []).map(watchlistSymbolToJsonRow);
}

async function buildJsonPayload(
  watchlist: Watchlist,
  quotes: boolean
): Promise<Record<string, unknown>> {
  // Filter out expired CALL options per business rule (ET cutoff, keep expiring-today visible)
  const rawSymbolsAll = watchlist.symbols ?? [];
  const rawSymbols = rawSymbolsAll.filter((s) => !isExpiredCallOption(s.symbol));

  const filteredWatchlist: Watchlist = {
    ...watchlist,
    symbols: rawSymbols
  } as Watchlist;

  const symbols = toIsoSymbolRows(filteredWatchlist);
  const symbolsDetailed = symbols;

  let symbolsWithQuotes:
    | Array<{
        symbol: string;
        addedAt: string;
        lineType?: string;
        strategy?: string;
        quantity?: number;
        entryPrice?: number;
        priceAlertMinAbsMovePercent?: number;
        lastPrice?: number;
        lastUpdatedAt?: string;
        quote: SymbolLookupResult | null;
      }>
    | undefined;

  if (quotes) {
    const map = await lookupSymbols(rawSymbols.map((s) => s.symbol));
    symbolsWithQuotes = rawSymbols.map((s) => ({
      ...watchlistSymbolToJsonRow(s),
      quote: map.get(s.symbol) ?? null
    }));
  }

  return {
    data: {
      ...filteredWatchlist,
      symbols,
      symbolsDetailed,
      ...(symbolsWithQuotes ? { symbolsWithQuotes } : {})
    },
    metadata: {
      lookupRoute: LOOKUP_ROUTE,
      symbolLookupEnabled: quotes,
      scope: "user"
    }
  };
}

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDenied = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDenied) {
    return tenantDenied;
  }

  const quotes = new URL(request.url).searchParams.get("quotes") === "1";
  const watchlist = await ensureUserWatchlistForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const payload = await buildJsonPayload(watchlist, quotes);
  return NextResponse.json(payload);
}

export async function PATCH(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantDeniedPatch = requireTenantHexForPortfolioDataPlane(session);
  if (tenantDeniedPatch) {
    return tenantDeniedPatch;
  }

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

  const ensured = await ensureUserWatchlistForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  if (!ensured) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const updated = await mutateUserWatchlistSymbols({
    userId: session.userId,
    tenantId: session.tenantId,
    name: parsed.data.name,
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

  const quotes = new URL(request.url).searchParams.get("quotes") === "1";
  const payload = await buildJsonPayload(updated, quotes);
  return NextResponse.json(payload);
}
