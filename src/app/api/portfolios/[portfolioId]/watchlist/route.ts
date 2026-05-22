import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { fireAndForgetArchiveAdvisorSystemAdvice } from "@/modules/compliance/advisor-advice-events";
import {
    createUserWatchlist,
    ensurePortfolioWatchlistForUser,
    getUserWatchlistById,
    listUserWatchlists,
    mutatePortfolioWatchlistSymbols
} from "@/modules/core-admin/repository";
import {
    accountOutlookValues,
    type Watchlist,
    type WatchlistSymbol
} from "@/modules/core-admin/types";
import { summarizeNearestExpiryOptionsHighlight } from "@/modules/find-options/options-hot-scan";
import { computeRsiFromCloses } from "@/modules/find-options/rsi";
import { underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";
import {
    LOOKUP_ROUTE,
    lookupSymbols,
    type SymbolLookupResult
} from "@/modules/watchlist/yahoo-symbol-lookup";
import {
    extractDailyClosesFromYahooChart,
    yahooChartWithValidationFallback
} from "@/modules/yahoo/yahoo-chart-validation-fallback";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

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

const createBodySchema = z.object({
  name: z.string().trim().min(1).max(128)
});

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
const TECHNICALS_BATCH = 4;
const SPARKLINE_POINTS = 7;

type WatchlistTechnicals = {
  rsi14: number | null;
  sparkline7d: number[] | null;
};

function normalizeSparkline(values: number[]): number[] | null {
  const cleaned = values.filter((value) => Number.isFinite(value) && value > 0);
  if (cleaned.length < 2) {
    return null;
  }
  return cleaned.slice(-SPARKLINE_POINTS);
}

async function buildTechnicalsBySymbol(symbols: string[]): Promise<Map<string, WatchlistTechnicals>> {
  const out = new Map<string, WatchlistTechnicals>();
  if (symbols.length === 0) {
    return out;
  }
  const yf = getYahooFinance2();
  const period2 = new Date();
  const period1 = new Date(period2.getTime() - 120 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < symbols.length; i += TECHNICALS_BATCH) {
    const batch = symbols.slice(i, i + TECHNICALS_BATCH);
    const rows = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const chart = await yahooChartWithValidationFallback(yf, symbol, {
            period1,
            period2,
            interval: "1d"
          });
          const closes = extractDailyClosesFromYahooChart(chart);
          return {
            symbol,
            technicals: {
              rsi14: computeRsiFromCloses(closes, 14),
              sparkline7d: normalizeSparkline(closes)
            }
          };
        } catch {
          return {
            symbol,
            technicals: {
              rsi14: null,
              sparkline7d: null
            }
          };
        }
      })
    );
    for (const row of rows) {
      out.set(row.symbol, row.technicals);
    }
  }
  return out;
}

async function buildJsonPayload(
  watchlist: Watchlist,
  quotes: boolean,
  chainGlance: boolean,
  technicals: boolean
): Promise<Record<string, unknown>> {
  const rawSymbols = watchlist.symbols ?? [];
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
          optionVolume: number;
          expirationDate: string | null;
        } | null;
        technicals?: WatchlistTechnicals | null;
      }>
    | undefined;

  if (quotes) {
    const map = await lookupSymbols(rawSymbols.map((s) => s.symbol));
    const glanceBySymbol = new Map<
      string,
      | {
          contractType: "call" | "put";
          strike: number;
          impliedVolatilityPercent: number;
          openInterest: number;
          optionVolume: number;
          expirationDate: string | null;
        }
      | null
    >();
    const technicalsBySymbol = technicals
      ? await buildTechnicalsBySymbol(rawSymbols.map((s) => s.symbol.trim().toUpperCase()).filter(Boolean))
      : new Map<string, WatchlistTechnicals>();
    if (chainGlance && rawSymbols.length > 0) {
      const keys = rawSymbols.map((s) => s.symbol.trim().toUpperCase()).filter(Boolean);
      for (let i = 0; i < keys.length; i += CHAIN_GLANCE_BATCH) {
        const batch = keys.slice(i, i + CHAIN_GLANCE_BATCH);
        const results = await Promise.all(
          batch.map((sym) => summarizeNearestExpiryOptionsHighlight(underlyingForYahooOptionsChain(sym)))
        );
        batch.forEach((sym, j) => {
          const g = results[j];
          glanceBySymbol.set(
            sym,
            g
              ? {
                  contractType: g.contractType,
                  strike: g.strike,
                  impliedVolatilityPercent: g.impliedVolatilityPercent,
                  openInterest: g.openInterest,
                  optionVolume: g.optionVolume,
                  expirationDate: g.expirationDate
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
        /** Keys in {@link lookupSymbols} map are normalized uppercase. */
        quote: map.get(key) ?? map.get(s.symbol.trim()) ?? null
      };
      if (chainGlance) {
        return {
          ...base,
          chainGlance: glanceBySymbol.get(key) ?? null,
          ...(technicals ? { technicals: technicalsBySymbol.get(key) ?? null } : {})
        };
      }
      return {
        ...base,
        ...(technicals ? { technicals: technicalsBySymbol.get(key) ?? null } : {})
      };
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
  const searchParams = new URL(request.url).searchParams;
  const quotes = searchParams.get("quotes") === "1";
  const chainGlance = searchParams.get("chainGlance") === "1";
  const technicals = searchParams.get("technicals") === "1";
  const selectedWatchlistId = searchParams.get("watchlistId")?.trim() ?? "";
  const fallbackWatchlist = await ensurePortfolioWatchlistForUser({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (!fallbackWatchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }
  const selectedWatchlist =
    selectedWatchlistId.length > 0
      ? await getUserWatchlistById({
          userId: session.userId,
          tenantId: session.tenantId,
          watchlistId: selectedWatchlistId
        })
      : null;
  const watchlist = selectedWatchlist ?? fallbackWatchlist;
  const allWatchlists = await listUserWatchlists({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const payload = await buildJsonPayload(watchlist, quotes, quotes && chainGlance, quotes && technicals);
  const watchlists = allWatchlists.map((row) => ({
    id: row._id?.toHexString() ?? "",
    name: row.name,
    symbolCount: Array.isArray(row.symbols) ? row.symbols.length : 0,
    isDefault: row.isDefault === true,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null
  }));
  payload.data = {
    ...(payload.data as Record<string, unknown>),
    watchlists,
    activeWatchlistId: watchlist._id?.toHexString() ?? null
  };
  return NextResponse.json(payload);
}

export async function POST(request: Request, context: RouteContext) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const { portfolioId } = await context.params;
  const ensured = await ensurePortfolioWatchlistForUser({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (!ensured) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await createUserWatchlist({
    userId: session.userId,
    tenantId: session.tenantId,
    name: parsed.data.name,
    watchlistSymbols: [ensured.symbols?.[0]?.symbol ?? "TSLA"]
  });
  if (!created?._id) {
    return NextResponse.json(
      { error: "Could not create watchlist (name may already exist)." },
      { status: 409 }
    );
  }
  return NextResponse.json({
    data: {
      id: created._id.toHexString(),
      name: created.name
    }
  });
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

  const watchlistId = new URL(request.url).searchParams.get("watchlistId")?.trim() ?? undefined;
  const updated = await mutatePortfolioWatchlistSymbols({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId,
    watchlistId,
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
  const technicals = new URL(request.url).searchParams.get("technicals") === "1";
  const payload = await buildJsonPayload(updated, quotes, quotes && chainGlance, quotes && technicals);
  if (entries?.length) {
    for (const entry of entries) {
      const rationale = entry.rationale?.trim() ?? "";
      if (rationale.length === 0) {
        continue;
      }
      fireAndForgetArchiveAdvisorSystemAdvice({
        roles: session.roles,
        tenantId: session.tenantId,
        userId: session.userId,
        surface: "portfolio_watchlist",
        artifactKind: "watchlist_rationale",
        prompt: JSON.stringify({
          portfolioId,
          symbol: entry.symbol,
          rowStatus: entry.rowStatus ?? null,
          lineType: entry.lineType ?? null,
          strategy: entry.strategy ?? null
        }),
        responseText: rationale,
        metadata: { source: "watchlist_patch_add_entries" }
      });
    }
  }
  return NextResponse.json(payload);
}
