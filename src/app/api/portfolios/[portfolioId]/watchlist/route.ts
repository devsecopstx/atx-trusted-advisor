import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionUser } from "@/lib/auth";
import {
    getPortfolioWatchlist,
    mutatePortfolioWatchlistSymbols
} from "@/modules/core-admin/repository";
import type { Watchlist, WatchlistSymbol } from "@/modules/core-admin/types";
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
  lineType: z.string().trim().max(128).optional(),
  strategy: z.string().trim().max(512).optional(),
  quantity: z.number().finite().optional(),
  entryPrice: z.number().finite().optional()
});

const patchBodySchema = z
  .object({
    addSymbols: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    addEntries: z.array(watchlistAddEntrySchema).max(20).optional(),
    removeSymbols: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
    dedupe: z.boolean().optional()
  })
  .refine(
    (data) =>
      Boolean(data.addSymbols?.length) ||
      Boolean(data.addEntries?.length) ||
      Boolean(data.removeSymbols?.length) ||
      data.dedupe === true,
    { message: "Provide addSymbols, addEntries, removeSymbols, or dedupe: true" }
  );

function watchlistSymbolToJsonRow(item: WatchlistSymbol) {
  return {
    symbol: item.symbol,
    addedAt: item.addedAt.toISOString(),
    ...(item.lineType !== undefined ? { lineType: item.lineType } : {}),
    ...(item.strategy !== undefined ? { strategy: item.strategy } : {}),
    ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
    ...(item.entryPrice !== undefined ? { entryPrice: item.entryPrice } : {})
  };
}

function toIsoSymbolRows(watchlist: Watchlist) {
  return (watchlist.symbols ?? []).map(watchlistSymbolToJsonRow);
}

async function buildJsonPayload(
  watchlist: Watchlist,
  quotes: boolean
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
        quote: SymbolLookupResult | null;
      }>
    | undefined;

  const rawSymbols = watchlist.symbols ?? [];
  if (quotes) {
    const map = await lookupSymbols(rawSymbols.map((s) => s.symbol));
    symbolsWithQuotes = rawSymbols.map((s) => ({
      ...watchlistSymbolToJsonRow(s),
      quote: map.get(s.symbol) ?? null
    }));
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
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const quotes = new URL(request.url).searchParams.get("quotes") === "1";
  const watchlist = await getPortfolioWatchlist({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const payload = await buildJsonPayload(watchlist, quotes);
  return NextResponse.json(payload);
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const updated = await mutatePortfolioWatchlistSymbols({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId,
    addSymbols: parsed.data.addSymbols,
    addEntries: parsed.data.addEntries,
    removeSymbols: parsed.data.removeSymbols,
    dedupe: parsed.data.dedupe
  });

  if (!updated) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const quotes = new URL(request.url).searchParams.get("quotes") === "1";
  const payload = await buildJsonPayload(updated, quotes);
  return NextResponse.json(payload);
}
