import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

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
    const target100 = row.targetNotional100xUsd ?? "—";
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

export async function postProcessWatchlistMarkdown(
  input: PostProcessWatchlistMarkdownInput
): Promise<string> {
  const hasStructured = Array.isArray(input.structuredRows) && input.structuredRows.length > 0;
  if (
    !hasStructured &&
    input.rawMarkdown.includes("| Symbol |") &&
    input.rawMarkdown.includes("| Spot |")
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

  const enriched = await enrichRowsWithMarketPulse(baseRows);
  return renderEnhancedTableMarkdown({
    watchlistName: input.watchlistName,
    rows: enriched,
    portfolioId: input.portfolioId
  });
}
