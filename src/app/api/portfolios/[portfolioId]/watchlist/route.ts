import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import {
    ensurePortfolioWatchlistForUser,
    mutatePortfolioWatchlistSymbols
} from "@/modules/core-admin/repository";
import {
    accountOutlookValues,
    type Watchlist,
    type WatchlistSymbol
} from "@/modules/core-admin/types";
import { summarizeNearestExpiryOptionsHighlight } from "@/modules/find-options/options-hot-scan";
import {
    LOOKUP_ROUTE,
    lookupSymbols,
    type SymbolLookupResult
} from "@/modules/watchlist/yahoo-symbol-lookup";

type RouteContext = {
  params: Promise<{
    portfolioId: string;
  }>;
};

const watchlistAddEntrySchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  lineType: z.union([z.string().trim().max(128), z.null()]).optional(),
  strategy: z.union([z.string().trim().max(512), z.null()]).optional(),
  quantity: z.union([z.number().finite(), z.null()]).optional(),
  entryPrice: z.union([z.number().finite(), z.null()]).optional(),
  rationale: z.union([z.string().trim().max(4000), z.null()]).optional(),
  rowStatus: z.union([z.enum(["draft", "active", "review"]), z.null()]).optional(),
  /** Min absolute % move to fire price alerts for this row; null clears. */
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
    ...(item.rationale !== undefined ? { rationale: item.rationale } : {}),
    ...(item.rowStatus !== undefined ? { rowStatus: item.rowStatus } : {}),
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

const CHAIN_GLANCE_BATCH = 4;

async function buildJsonPayload(
  watchlist: Watchlist,
  quotes: boolean,
  chainGlance: boolean
): Promise<Record<string, unknown>> {
  const symbols = toIsoSymbolRows(watchlist);
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
        chainGlance?: {
          contractType: "call" | "put";
          strike: number;
          impliedVolatilityPercent: number;
          openInterest: number;
        } | null;
      }>
    | undefined;

  const rawSymbols = watchlist.symbols ?? [];
  if (quotes) {
    const map = await lookupSymbols(rawSymbols.map((s) => s.symbol));
    const glanceBySymbol = new Map<
      string,
      | {
          contractType: "call" | "put";
          strike: number;
          impliedVolatilityPercent: number;
          openInterest: number;
        }
      | null
    >();
    if (chainGlance && rawSymbols.length > 0) {
      const keys = rawSymbols.map((s) => s.symbol.trim().toUpperCase()).filter(Boolean);
      for (let i = 0; i < keys.length; i += CHAIN_GLANCE_BATCH) {
        const batch = keys.slice(i, i + CHAIN_GLANCE_BATCH);
        const results = await Promise.all(batch.map((sym) => summarizeNearestExpiryOptionsHighlight(sym)));
        batch.forEach((sym, j) => {
          const g = results[j];
          glanceBySymbol.set(
            sym,
            g
              ? {
                  contractType: g.contractType,
                  strike: g.strike,
                  impliedVolatilityPercent: g.impliedVolatilityPercent,
                  openInterest: g.openInterest
                }
              : null
          );
        });
      }
    }
    symbolsWithQuotes = rawSymbols.map((s) => {
      const key = s.symbol.trim().toUpperCase();
      const base = {
        ...watchlistSymbolToJsonRow(s),
        quote: map.get(s.symbol) ?? null
      };
      if (chainGlance) {
        return { ...base, chainGlance: glanceBySymbol.get(key) ?? null };
      }
      return base;
    });
  }

  return {
    data: {
      ...watchlist,
      symbols,
      symbolsDetailed,
      ...(symbolsWithQuotes ? { symbolsWithQuotes } : {})
    },
    metadata: {
      lookupRoute: LOOKUP_ROUTE,
      symbolLookupEnabled: quotes
    }
  };
}

export async function GET(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const quotes = new URL(request.url).searchParams.get("quotes") === "1";
  const chainGlance = new URL(request.url).searchParams.get("chainGlance") === "1";
  const watchlist = await ensurePortfolioWatchlistForUser({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const payload = await buildJsonPayload(watchlist, quotes, quotes && chainGlance);
  return NextResponse.json(payload);
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
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

  const ensured = await ensurePortfolioWatchlistForUser({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (!ensured) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const entries = parsed.data.addEntries;
  if (entries?.length) {
    for (const e of entries) {
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
    userId: session.userId,
    portfolioId,
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
  const chainGlance = new URL(request.url).searchParams.get("chainGlance") === "1";
  const payload = await buildJsonPayload(updated, quotes, quotes && chainGlance);
  return NextResponse.json(payload);
}
