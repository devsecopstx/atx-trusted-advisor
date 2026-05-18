import {
    getYahooBatchQuotes,
    marketQuoteHasLivePrice
} from "@/modules/watchlist/yahoo-batch-quotes";
import { tryGetRedisMarketQuote } from "@/modules/xchat/market-quote-redis-cache";
import { formatWatchlistSpotPriceUsd } from "@/modules/xchat/watchlist-prompt-format";

import type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

export const MARKET_DATA_DISCLAIMER =
  "Market data is sourced from Yahoo Finance and may be delayed, incomplete, or inaccurate. " +
  "Use an exchange-grade feed for trading decisions.";

export class MarketQuoteUnavailableError extends Error {
  readonly code = "market_quote_unavailable" as const;
  readonly symbol: string;

  constructor(symbol: string, cause?: unknown) {
    super(`Market quote unavailable for ${symbol}`);
    this.name = "MarketQuoteUnavailableError";
    this.symbol = symbol;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function normalizeSymbol(raw: unknown): string {
  const fallback = "TSLA";
  if (typeof raw !== "string") {
    return fallback;
  }
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) {
    return fallback;
  }
  if (!/^[A-Z0-9.^-]{1,15}$/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export async function getYahooMarketQuote(input: {
  symbol?: string;
}): Promise<MarketQuoteSnapshot> {
  const symbol = normalizeSymbol(input.symbol);
  const cached = await tryGetRedisMarketQuote(symbol);
  if (cached && marketQuoteHasLivePrice(cached)) {
    return cached;
  }

  const rows = await getYahooBatchQuotes([symbol]);
  const row = rows.find((r) => r.symbol.trim().toUpperCase() === symbol) ?? rows[0];
  if (!row || !marketQuoteHasLivePrice(row)) {
    throw new MarketQuoteUnavailableError(symbol);
  }
  return row;
}

/** Deterministic xChat direct-quote markdown (no LLM formatting). */
export function formatDirectMarketQuoteMarkdown(snapshot: MarketQuoteSnapshot): string {
  const sym = snapshot.symbol.trim().toUpperCase();
  const price = formatWatchlistSpotPriceUsd(snapshot.price);
  const prev = formatWatchlistSpotPriceUsd(snapshot.previousClose);
  let changeLine = "—";
  if (
    typeof snapshot.change === "number" &&
    Number.isFinite(snapshot.change) &&
    typeof snapshot.changePercent === "number" &&
    Number.isFinite(snapshot.changePercent)
  ) {
    const chSign = snapshot.change >= 0 ? "+" : "";
    const pctSign = snapshot.changePercent >= 0 ? "+" : "";
    changeLine = `${chSign}${snapshot.change.toFixed(2)} (${pctSign}${snapshot.changePercent.toFixed(2)}%)`;
  }
  const displayName = snapshot.shortName?.trim() || snapshot.longName?.trim();
  const title = displayName ? `${sym} — ${displayName}` : sym;
  const lines = [
    `## ${title}`,
    "",
    `**Last:** ${price}`,
    `**Change:** ${changeLine}`,
    `**Previous close:** ${prev}`
  ];
  if (typeof snapshot.volume === "number" && Number.isFinite(snapshot.volume)) {
    lines.push(`**Volume:** ${snapshot.volume.toLocaleString("en-US")}`);
  }
  if (
    typeof snapshot.fiftyTwoWeekLow === "number" &&
    Number.isFinite(snapshot.fiftyTwoWeekLow) &&
    typeof snapshot.fiftyTwoWeekHigh === "number" &&
    Number.isFinite(snapshot.fiftyTwoWeekHigh)
  ) {
    lines.push(
      `**52-week range:** ${formatWatchlistSpotPriceUsd(snapshot.fiftyTwoWeekLow)} – ${formatWatchlistSpotPriceUsd(snapshot.fiftyTwoWeekHigh)}`
    );
  }
  lines.push("", snapshot.disclaimer?.trim() || MARKET_DATA_DISCLAIMER);
  lines.push("", "[@citation:market_quote|Yahoo Finance]");
  return lines.join("\n");
}
