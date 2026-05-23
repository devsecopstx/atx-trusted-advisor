import { NextResponse } from "next/server";

import type { HoldingsChainGlance } from "@/app/portfolio/lib/holdings-row-metrics";
import { requireSessionUser } from "@/lib/auth";
import { summarizeNearestExpiryOptionsHighlight } from "@/modules/find-options/options-hot-scan";
import { underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";

const MAX_SYMBOLS = 16;
const CHAIN_GLANCE_BATCH = 4;

function parseSymbols(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => underlyingForYahooOptionsChain(s.trim()).toUpperCase())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, MAX_SYMBOLS);
}

function serializeGlance(
  highlight: Awaited<ReturnType<typeof summarizeNearestExpiryOptionsHighlight>>
): HoldingsChainGlance | null {
  if (!highlight) {
    return null;
  }
  return {
    contractType: highlight.contractType,
    strike: highlight.strike,
    impliedVolatilityPercent: highlight.impliedVolatilityPercent,
    openInterest: highlight.openInterest,
    optionVolume: highlight.optionVolume,
    expirationDate: highlight.expirationDate
  };
}

/**
 * GET /api/market/chain-glance?symbols=TSLA,AAPL
 * Nearest-expiry IV/OI highlight — same Yahoo path as watchlist `?chainGlance=1`.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  if (symbols.length === 0) {
    return NextResponse.json({ data: {} as Record<string, HoldingsChainGlance | null> });
  }

  const data: Record<string, HoldingsChainGlance | null> = {};
  for (let i = 0; i < symbols.length; i += CHAIN_GLANCE_BATCH) {
    const batch = symbols.slice(i, i + CHAIN_GLANCE_BATCH);
    const results = await Promise.all(batch.map((sym) => summarizeNearestExpiryOptionsHighlight(sym)));
    batch.forEach((sym, j) => {
      data[sym] = serializeGlance(results[j] ?? null);
    });
  }

  return NextResponse.json({ data });
}
