import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { TENANT_PORTFOLIO_COLLECTION } from "@/modules/core-admin/collection-names";
import type { ScheduledTask } from "@/modules/core-admin/types";
import type { ScheduledCategoryResult } from "@/modules/scanner/core-scanner-service";
import {
    resolveUsMarketDayContext,
    updateTenantMarketCalendarSnapshot
} from "@/modules/scanner/tenant-market-calendar";
import { getYahooBatchQuotes } from "@/modules/watchlist/yahoo-batch-quotes";

const PORTFOLIO_COLLECTION = TENANT_PORTFOLIO_COLLECTION;
const ACCOUNT_COLLECTION = "portfolio_accounts";
const POSITION_COLLECTION = "portfolio_positions";
const WATCHLIST_COLLECTION = "portfolio_watchlists";

type ScannerPosition = {
  symbol?: unknown;
};

type ScannerWatchlist = {
  _id?: ObjectId;
  symbols?: Array<{ symbol?: unknown; [key: string]: unknown }>;
};

type QuoteSnapshot = {
  symbol: string;
  price?: number;
};

function normalizeTicker(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim().toUpperCase();
  if (!s || s === "USD" || s === "CASH") {
    return null;
  }
  if (!/^[A-Z][A-Z0-9.\-]{0,10}$/.test(s)) {
    return null;
  }
  return s;
}

function tenantFilter(tenantId?: ObjectId): Record<string, unknown> {
  if (tenantId) {
    return { tenantId };
  }
  return {};
}

async function updateWatchlistPrices(
  watchlists: ScannerWatchlist[],
  quoteBySymbol: Map<string, number>,
  now: Date
): Promise<number> {
  if (watchlists.length === 0) {
    return 0;
  }
  const db = await getDb();
  const writes: Array<{
    updateOne: {
      filter: { _id: ObjectId };
      update: { $set: { symbols: ScannerWatchlist["symbols"]; updatedAt: Date } };
    };
  }> = [];
  let symbolUpdates = 0;

  for (const wl of watchlists) {
    if (!wl._id || !Array.isArray(wl.symbols) || wl.symbols.length === 0) {
      continue;
    }
    let changed = false;
    const nextSymbols = wl.symbols.map((entry) => {
      const symbol = normalizeTicker(entry?.symbol);
      if (!symbol) {
        return entry;
      }
      const price = quoteBySymbol.get(symbol);
      if (price === undefined) {
        return entry;
      }
      changed = true;
      symbolUpdates += 1;
      // lastUpdatedAt: surfaced on watchlist rows as "Last update" after GET (price_scanner job).
      return {
        ...entry,
        lastPrice: price,
        lastUpdatedAt: now
      };
    });
    if (changed) {
      writes.push({
        updateOne: {
          filter: { _id: wl._id },
          update: { $set: { symbols: nextSymbols, updatedAt: now } }
        }
      });
    }
  }

  if (writes.length > 0) {
    await db.collection(WATCHLIST_COLLECTION).bulkWrite(writes, { ordered: false });
  }
  return symbolUpdates;
}

export async function runPriceScanner(task: ScheduledTask): Promise<ScheduledCategoryResult> {
  const start = Date.now();
  const db = await getDb();
  const scope = tenantFilter(task.tenantId);
  const market = resolveUsMarketDayContext(new Date());

  const [portfolioCount, accountCount] = await Promise.all([
    db.collection(PORTFOLIO_COLLECTION).countDocuments(scope),
    db.collection(ACCOUNT_COLLECTION).countDocuments(scope)
  ]);

  if (!market.isBusinessDay || !market.marketWindowOpen) {
    await updateTenantMarketCalendarSnapshot({
      tenantId: task.tenantId,
      market,
      symbolCount: 0,
      quoteCount: 0,
      portfolioCount,
      accountCount,
      holdingsCount: 0,
      watchlistCount: 0,
      sourceTaskCategory: "price_scanner"
    });
    const reason = market.isHoliday
      ? `holiday (${market.holidayName ?? "market holiday"})`
      : "outside market hours";
    return {
      status: "success",
      output: `price_scanner: skipped — ${reason} [${market.marketDate} ${market.timezone}]`,
      auditDetails: {
        skipped: true,
        marketDate: market.marketDate,
        marketTimezone: market.timezone,
        holiday: market.holidayName ?? null,
        portfolioCount,
        accountCount
      }
    };
  }

  const [positions, watchlists] = await Promise.all([
    db
      .collection<ScannerPosition>(POSITION_COLLECTION)
      .find(scope, { projection: { symbol: 1 } })
      .toArray(),
    db
      .collection<ScannerWatchlist>(WATCHLIST_COLLECTION)
      .find(scope, { projection: { symbols: 1 } })
      .toArray()
  ]);

  const symbols = new Set<string>();
  for (const pos of positions) {
    const symbol = normalizeTicker(pos.symbol);
    if (symbol) {
      symbols.add(symbol);
    }
  }
  for (const wl of watchlists) {
    for (const entry of wl.symbols ?? []) {
      const symbol = normalizeTicker(entry?.symbol);
      if (symbol) {
        symbols.add(symbol);
      }
    }
  }

  const symbolList = Array.from(symbols).sort();
  const quotes = (await getYahooBatchQuotes(symbolList)) as QuoteSnapshot[];
  const quoteBySymbol = new Map<string, number>();
  for (const quote of quotes) {
    const symbol = normalizeTicker(quote.symbol);
    if (!symbol || typeof quote.price !== "number" || !Number.isFinite(quote.price)) {
      continue;
    }
    quoteBySymbol.set(symbol, quote.price);
  }

  const now = new Date();
  const watchlistSymbolUpdates = await updateWatchlistPrices(watchlists, quoteBySymbol, now);
  await updateTenantMarketCalendarSnapshot({
    tenantId: task.tenantId,
    market,
    symbolCount: symbolList.length,
    quoteCount: quoteBySymbol.size,
    portfolioCount,
    accountCount,
    holdingsCount: positions.length,
    watchlistCount: watchlists.length,
    sourceTaskCategory: "price_scanner"
  });

  const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(1));
  return {
    status: "success",
    output: `price_scanner: scanned ${symbolList.length} symbols (${quoteBySymbol.size} quoted) across ${portfolioCount} portfolios, ${accountCount} accounts, ${positions.length} holdings, ${watchlists.length} watchlists in ${durationSeconds}s`,
    auditDetails: {
      marketDate: market.marketDate,
      marketTimezone: market.timezone,
      durationSeconds,
      portfolioCount,
      accountCount,
      holdingsCount: positions.length,
      watchlistCount: watchlists.length,
      symbolCount: symbolList.length,
      quotedSymbolCount: quoteBySymbol.size,
      watchlistSymbolUpdates
    }
  };
}
