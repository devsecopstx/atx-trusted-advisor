import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

type WatchlistStructuredRow = {
  symbol: string;
  spotPriceDisplay?: string;
  entryPrice?: number;
  targetEntryPrice?: number;
  targetEntryNotional100xUsdDisplay?: string;
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
};

type PostProcessWatchlistMarkdownInput = {
  rawMarkdown: string;
  watchlistName?: string;
  structuredRows?: WatchlistStructuredRow[];
  portfolioId?: string;
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
      return {
        symbol,
        livePrice,
        targetEntryPrice: targetFromRow
      };
    })
    .filter((row) => row.symbol.length > 0);
}

async function enrichRowsWithMarketPulse(
  rows: EnhancedWatchlistRenderRow[]
): Promise<EnhancedWatchlistRenderRow[]> {
  if (rows.length === 0) {
    return rows;
  }
  const symbolMap = await lookupSymbols(rows.map((row) => row.symbol));
  return rows.map((row) => {
    const pulse = symbolMap.get(row.symbol);
    return {
      ...row,
      livePrice:
        typeof pulse?.price === "number" && Number.isFinite(pulse.price) ? pulse.price : row.livePrice,
      marketPulse: pulse
    };
  });
}

function renderEnhancedTableMarkdown(input: {
  watchlistName?: string;
  rows: EnhancedWatchlistRenderRow[];
  portfolioId?: string;
}): string {
  const title = input.watchlistName?.trim() || "watchlist";
  const header = `Your ${title} has ${input.rows.length} symbol${input.rows.length === 1 ? "" : "s"}:`;
  const tableLines = [
    "| Symbol | Spot | 1D Delta | Distance to Target | xOptions CTA |",
    "|---|---:|---:|---:|---|"
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
    const cta = `[Open ${symbol} in xOptions](${ctaHref} "Open xOptions for ${symbol}")`;
    tableLines.push(`| ${symbol} | ${spot} | ${delta} | ${distance} | ${cta} |`);
  }
  return [
    header,
    "",
    ...tableLines,
    "",
    "_Accessibility note: each CTA includes the symbol in visible link text and title for clearer screen-reader narration._"
  ].join("\n");
}

export async function postProcessWatchlistMarkdown(
  input: PostProcessWatchlistMarkdownInput
): Promise<string> {
  if (input.rawMarkdown.includes("| Symbol |") && input.rawMarkdown.includes("| Spot |")) {
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

  const enriched = await enrichRowsWithMarketPulse(baseRows);
  return renderEnhancedTableMarkdown({
    watchlistName: input.watchlistName,
    rows: enriched,
    portfolioId: input.portfolioId
  });
}
