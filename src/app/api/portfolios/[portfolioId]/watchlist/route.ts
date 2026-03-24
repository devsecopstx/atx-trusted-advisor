import { NextResponse } from "next/server";
import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth";
import { proxyRequestToBackend } from "@/lib/backend-bff";
import { caughtErrorMessage } from "@/lib/caught-error";
import {
    getPortfolioByIdForSessionUser,
    getPortfolioWatchlist,
    mutatePortfolioWatchlistSymbols,
    provisionDefaultPortfolioForUser
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
  entryPrice: z.union([z.number().finite(), z.null()]).optional()
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
    ...(item.entryPrice !== undefined ? { entryPrice: item.entryPrice } : {})
  };
}

function toIsoSymbolRows(watchlist: Watchlist) {
  return (watchlist.symbols ?? []).map(watchlistSymbolToJsonRow);
}

/**
 * When the user owns the portfolio but the watchlist doc was never created (or failed to seed),
 * run the same idempotent provision used by Portfolio / Sync so TSLA default-root is present.
 */
async function getPortfolioWatchlistOrProvision(
  session: SessionUser,
  portfolioId: string
): Promise<Watchlist | null> {
  const existing = await getPortfolioWatchlist({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  if (existing) {
    return existing;
  }
  const portfolio = await getPortfolioByIdForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId,
    portfolioId
  });
  if (!portfolio?._id) {
    return null;
  }
  try {
    await provisionDefaultPortfolioForUser({
      userId: session.userId,
      tenantId: session.tenantId,
      watchlistSymbols: ["TSLA"]
    });
  } catch (error) {
    const detail = caughtErrorMessage(error);
    console.error(
      `[api/watchlist] provision default watchlist failed userId=${session.userId} portfolioId=${portfolioId} detail=${detail}`
    );
    return null;
  }
  return getPortfolioWatchlist({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
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
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }

  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { portfolioId } = await context.params;
  const quotes = new URL(request.url).searchParams.get("quotes") === "1";
  const watchlist = await getPortfolioWatchlistOrProvision(session, portfolioId);
  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const payload = await buildJsonPayload(watchlist, quotes);
  return NextResponse.json(payload);
}

export async function PATCH(request: Request, context: RouteContext) {
  const proxied = await proxyRequestToBackend(request);
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

  const ensured = await getPortfolioWatchlistOrProvision(session, portfolioId);
  if (!ensured) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
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
  const payload = await buildJsonPayload(updated, quotes);
  return NextResponse.json(payload);
}
