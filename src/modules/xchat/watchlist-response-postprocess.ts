import { resolveLiveQuotesForWatchlistSymbols } from "@/modules/watchlist/watchlist-live-quotes";
import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";
import {
    formatWatchlistTargetEntryNotional100xUsd
} from "@/modules/xchat/watchlist-prompt-format";

type WatchlistStructuredRow = {
  symbol: string;
  spotPriceDisplay?: string;
  entryPrice?: number;
  targetEntryPrice?: number;
  targetEntryNotional100xUsdDisplay?: string;
  targetEntryDisplay?: string;
  lineType?: string;
  strategy?: string;
  quantity?: number;
};

type ParsedLegacyWatchlistRow = {
  symbol: string;
  spotPrice?: number;
  targetEntryPrice?: number;
};

type EnhancedWatchlistRenderRow = {
  symbol: string;
  livePrice?: number;
  targetEntryPrice?: number;
  marketPulse?: SymbolLookupResult;
  lineType?: string;
  strategy?: string;
  quantity?: number;
  targetNotional100xUsd?: string;
  deskEntryDisplay?: string;
};

type PostProcessWatchlistMarkdownInput = {
  rawMarkdown: string;
  watchlistName?: string;
  structuredRows?: WatchlistStructuredRow[];
  portfolioId?: string;
  /** When true (default), always hit Yahoo on cache miss for Spot / Target entry columns. */
  allowLiveQuotes?: boolean;
};

function parseUsdNumber(input: string | undefined): number | undefined {
  if (!input) {
    return undefined;
  }
  const cleaned = input.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatSignedUsd(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = formatUsd(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatSignedPercent(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+${abs}%` : `-${abs}%`;
}

function buildXoptionsSymbolHref(symbol: string, portfolioId?: string): string {
  const params = new URLSearchParams();
  params.set("symbol", symbol);
  params.set("action", "build");
  if (portfolioId && /^[a-f\d]{24}$/i.test(portfolioId)) {
    params.set("portfolioId", portfolioId.toLowerCase());
  }
  return `/xoptions?${params.toString()}`;
}

function computeDistanceToTargetPct(input: {
  livePrice?: number;
  targetEntryPrice?: number;
}): number | undefined {
  const { livePrice, targetEntryPrice } = input;
  if (
    typeof livePrice !== "number" ||
    !Number.isFinite(livePrice) ||
    livePrice <= 0 ||
    typeof targetEntryPrice !== "number" ||
    !Number.isFinite(targetEntryPrice) ||
    targetEntryPrice <= 0
  ) {
    return undefined;
  }
  return ((targetEntryPrice - livePrice) / livePrice) * 100;
}

function parseLegacyWatchlistBulletRows(rawMarkdown: string): ParsedLegacyWatchlistRow[] {
  const lines = rawMarkdown.split(/\r?\n/);
  const rows: ParsedLegacyWatchlistRow[] = [];
  const bulletPattern = /^-\s+([A-Z0-9.\-]+)\s+—\s+Spot:\s+([^·]+?)(?:\s+·\s+Target entry:\s+(.+))?$/i;
  for (const line of lines) {
    const match = line.trim().match(bulletPattern);
    if (!match) {
      continue;
    }
    const symbol = match[1]?.trim().toUpperCase();
    if (!symbol) {
      continue;
    }
    const spotPrice = parseUsdNumber(match[2]);
    const targetEntryRaw = match[3]?.trim();
    const targetEntryPrice = targetEntryRaw ? parseUsdNumber(targetEntryRaw) : undefined;
    rows.push({
      symbol,
      spotPrice,
      targetEntryPrice
    });
  }
  return rows;
}

function structuredRowsToRenderRows(rows: WatchlistStructuredRow[]): EnhancedWatchlistRenderRow[] {
  return rows
    .map((row) => {
      const symbol = row.symbol.trim().toUpperCase();
      const livePrice = parseUsdNumber(row.spotPriceDisplay);
      const targetFromRow =
        typeof row.targetEntryPrice === "number" && Number.isFinite(row.targetEntryPrice)
          ? row.targetEntryPrice
          : typeof row.entryPrice === "number" && Number.isFinite(row.entryPrice)
            ? row.entryPrice
            : undefined;
      const desk =
        typeof row.targetEntryDisplay === "string" && row.targetEntryDisplay.trim().length > 0
          ? row.targetEntryDisplay.trim()
          : undefined;
      const notion =
        typeof row.targetEntryNotional100xUsdDisplay === "string" &&
        row.targetEntryNotional100xUsdDisplay.trim().length > 0 &&
        row.targetEntryNotional100xUsdDisplay.trim() !== "—"
          ? row.targetEntryNotional100xUsdDisplay.trim()
          : undefined;
      return {
        symbol,
        livePrice,
        targetEntryPrice: targetFromRow,
        lineType: row.lineType?.trim(),
        strategy: row.strategy?.trim(),
        quantity: row.quantity,
        targetNotional100xUsd: notion,
        deskEntryDisplay: desk
      };
    })
    .filter((row) => row.symbol.length > 0);
}

function snapshotToMarketPulse(
  symbol: string,
  snap: { price?: number; change?: number; changePercent?: number; volume?: number; dayLow?: number; dayHigh?: number; fiftyTwoWeekLow?: number; fiftyTwoWeekHigh?: number; currency?: string; shortName?: string; longName?: string }
): SymbolLookupResult {
  return {
    symbol,
    price: snap.price,
    change: snap.change,
    changePercent: snap.changePercent,
    volume: snap.volume,
    low: snap.dayLow,
    high: snap.dayHigh,
    fiftyTwoWeekLow: snap.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: snap.fiftyTwoWeekHigh,
    currency: snap.currency,
    companyName: snap.shortName ?? snap.longName,
    source: "yahoo-finance2"
  };
}

async function enrichRowsWithMarketPulse(
  rows: EnhancedWatchlistRenderRow[],
  allowLiveQuotes: boolean
): Promise<EnhancedWatchlistRenderRow[]> {
  if (rows.length === 0) {
    return rows;
  }
  const symbols = rows.map((row) => row.symbol);
  const liveBySymbol = allowLiveQuotes
    ? await resolveLiveQuotesForWatchlistSymbols(symbols, { allowNetwork: true })
    : new Map();

  const symbolMap = await lookupSymbols(symbols, { allowNetwork: allowLiveQuotes });

  return rows.map((row) => {
    const snap = liveBySymbol.get(row.symbol);
    const pulse = symbolMap.get(row.symbol);
    let livePrice =
      typeof snap?.price === "number" && Number.isFinite(snap.price)
        ? snap.price
        : typeof pulse?.price === "number" && Number.isFinite(pulse.price)
          ? pulse.price
          : row.livePrice;
    let marketPulse = pulse;
    if (typeof livePrice === "number" && Number.isFinite(livePrice)) {
      if (pulse) {
        marketPulse = { ...pulse, price: livePrice };
      } else if (snap) {
        marketPulse = snapshotToMarketPulse(row.symbol, { ...snap, price: livePrice });
      }
    } else if (!marketPulse && snap) {
      marketPulse = snapshotToMarketPulse(row.symbol, snap);
    }
    const targetNotional100xUsd =
      typeof livePrice === "number" && Number.isFinite(livePrice)
        ? formatWatchlistTargetEntryNotional100xUsd(livePrice)
        : row.targetNotional100xUsd;
    return {
      ...row,
      livePrice,
      marketPulse,
      targetNotional100xUsd
    };
  });
}

function formatQty(q: number | undefined): string {
  if (typeof q !== "number" || !Number.isFinite(q)) {
    return "—";
  }
  return Number.isInteger(q) ? q.toLocaleString("en-US") : q.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function renderEnhancedTableMarkdown(input: {
  watchlistName?: string;
  rows: EnhancedWatchlistRenderRow[];
  portfolioId?: string;
}): string {
  const title = input.watchlistName?.trim() || "watchlist";
  const header = `### Watchlist — ${title}\n\n${input.rows.length} symbol${input.rows.length === 1 ? "" : "s"} (Spot and **Target entry** use live marks where available; desk **Entry** is your saved price).`;
  const tableLines = [
    "| Symbol | Type | Strategy | Qty | Spot | Target entry (100×) | Desk entry | 1D Δ | To target | xOptions |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---|"
  ];
  for (const row of input.rows) {
    const symbol = row.symbol;
    const spot = formatUsd(row.livePrice);
    const deltaUsd = formatSignedUsd(row.marketPulse?.change);
    const deltaPct = formatSignedPercent(row.marketPulse?.changePercent);
    const delta = deltaUsd === "—" && deltaPct === "—" ? "—" : `${deltaUsd} (${deltaPct})`;
    const distancePct = computeDistanceToTargetPct({
      livePrice: row.livePrice,
      targetEntryPrice: row.targetEntryPrice
    });
    const distance = formatSignedPercent(distancePct);
    const ctaHref = buildXoptionsSymbolHref(symbol, input.portfolioId);
    const cta = `[Open ${symbol}](${ctaHref} "Open xOptions for ${symbol}")`;
    const lineType = row.lineType && row.lineType.length > 0 ? row.lineType : "—";
    const strategy = row.strategy && row.strategy.length > 0 ? row.strategy : "—";
    const qty = formatQty(row.quantity);
    const target100 =
      row.targetNotional100xUsd && row.targetNotional100xUsd !== "—"
        ? row.targetNotional100xUsd
        : formatWatchlistTargetEntryNotional100xUsd(row.livePrice);
    const desk =
      row.deskEntryDisplay && row.deskEntryDisplay.length > 0
        ? row.deskEntryDisplay
        : formatUsd(row.targetEntryPrice);
    tableLines.push(
      `| ${symbol} | ${lineType} | ${strategy} | ${qty} | ${spot} | ${target100} | ${desk} | ${delta} | ${distance} | ${cta} |`
    );
  }
  return [
    header,
    "",
    ...tableLines,
    "",
    "_Not investment advice. Quotes are indicative._"
  ].join("\n");
}

/** Merge Yahoo snapshots into structured tool rows before markdown post-process. */
export function mergeWatchlistStructuredRowsWithLiveQuotes(
  rows: WatchlistStructuredRow[],
  liveBySymbol: Map<string, { price?: number; change?: number; changePercent?: number }>
): WatchlistStructuredRow[] {
  return rows.map((row) => {
    const sym = row.symbol.trim().toUpperCase();
    const snap = liveBySymbol.get(sym);
    if (typeof snap?.price !== "number" || !Number.isFinite(snap.price)) {
      return row;
    }
    return {
      ...row,
      spotPriceDisplay: formatUsd(snap.price),
      targetEntryNotional100xUsdDisplay: formatWatchlistTargetEntryNotional100xUsd(snap.price)
    };
  });
}

function watchlistMarkdownTableHasPopulatedSpotColumn(markdown: string): boolean {
  if (!markdown.includes("| Symbol |") || !markdown.includes("| Spot |")) {
    return false;
  }
  return /\|\s*\$[\d,]+\.\d{2}\s*\|/.test(markdown);
}

export async function postProcessWatchlistMarkdown(
  input: PostProcessWatchlistMarkdownInput
): Promise<string> {
  const allowLiveQuotes = input.allowLiveQuotes !== false;
  const hasStructured = Array.isArray(input.structuredRows) && input.structuredRows.length > 0;
  if (
    !hasStructured &&
    input.rawMarkdown.includes("| Symbol |") &&
    input.rawMarkdown.includes("| Spot |") &&
    watchlistMarkdownTableHasPopulatedSpotColumn(input.rawMarkdown)
  ) {
    return input.rawMarkdown;
  }

  const fromStructured = Array.isArray(input.structuredRows)
    ? structuredRowsToRenderRows(input.structuredRows)
    : [];
  const baseRows =
    fromStructured.length > 0
      ? fromStructured
      : parseLegacyWatchlistBulletRows(input.rawMarkdown).map((row) => ({
          symbol: row.symbol,
          livePrice: row.spotPrice,
          targetEntryPrice: row.targetEntryPrice
        }));

  if (baseRows.length === 0) {
    return input.rawMarkdown;
  }

  const enriched = await enrichRowsWithMarketPulse(baseRows, allowLiveQuotes);
  return renderEnhancedTableMarkdown({
    watchlistName: input.watchlistName,
    rows: enriched,
    portfolioId: input.portfolioId
  });
}
