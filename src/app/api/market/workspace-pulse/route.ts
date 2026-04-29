import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { summarizeNearestExpiryOptionsHighlight } from "@/modules/find-options/options-hot-scan";
import { resolveUsMarketDayContext } from "@/modules/scanner/us-market-day-context";
import { lookupSymbols, type SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

const MAX_HOLDINGS_GLANCE = 2;

function parseHoldings(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const parts = raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{1,5}$/.test(s));
  return [...new Set(parts)].slice(0, MAX_HOLDINGS_GLANCE);
}

/** Display symbol (e.g. `VIX`) may differ from Yahoo key (`^VIX`). */
function serializeQuote(displaySymbol: string, q: SymbolLookupResult | null | undefined) {
  if (!q) {
    return {
      symbol: displaySymbol,
      price: undefined as number | undefined,
      changePercent: undefined as number | undefined
    };
  }
  return {
    symbol: displaySymbol,
    price: q.price,
    changePercent: q.changePercent
  };
}

/** HNWI-oriented macro row: vol, core ETFs, small-cap breadth, Dow, rates proxy. */
const WORKSPACE_MACRO_INDICES: ReadonlyArray<{ yahoo: string; symbol: string }> = [
  { yahoo: "^VIX", symbol: "VIX" },
  { yahoo: "SPY", symbol: "SPY" },
  { yahoo: "QQQ", symbol: "QQQ" },
  { yahoo: "IWM", symbol: "IWM" },
  { yahoo: "DIA", symbol: "DIA" },
  { yahoo: "TLT", symbol: "TLT" }
];

type SearchNewsRow = {
  title?: string;
  link?: string;
  publisher?: string;
};

/**
 * GET /api/market/workspace-pulse?holdings=TSLA,AAPL
 * Macro indices (VIX, SPY, QQQ, IWM, DIA, TLT), Yahoo search headlines, optional per-holding options IV/OI glance.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const holdings = parseHoldings(searchParams.get("holdings"));

  const yf = getYahooFinance2();

  const macroYahoo = WORKSPACE_MACRO_INDICES.map((m) => m.yahoo);
  const [macroQuotes, searchRes, ...optionHighlights] = await Promise.all([
    lookupSymbols(macroYahoo),
    yf
      .search("US stock market", {
        newsCount: 6,
        quotesCount: 0
      })
      .catch(() => ({ news: [] as SearchNewsRow[] })),
    ...holdings.map((sym) => summarizeNearestExpiryOptionsHighlight(sym))
  ]);

  const newsRaw = Array.isArray(searchRes.news) ? searchRes.news : [];
  const news: { title: string; link: string; publisher?: string }[] = [];
  for (const n of newsRaw) {
    const title = typeof n.title === "string" ? n.title.trim() : "";
    let link = typeof n.link === "string" ? n.link.trim() : "";
    if (link.startsWith("/")) {
      link = `https://finance.yahoo.com${link}`;
    }
    if (!title || !link) {
      continue;
    }
    const publisherRaw = typeof n.publisher === "string" ? n.publisher.trim() : "";
    const publisher = publisherRaw.length > 0 ? publisherRaw : undefined;
    news.push({ title, link, publisher });
    if (news.length >= 4) {
      break;
    }
  }

  const indices = WORKSPACE_MACRO_INDICES.map(({ yahoo, symbol }) =>
    serializeQuote(symbol, macroQuotes.get(yahoo.trim().toUpperCase()))
  );

  const optionsGlance = holdings.map((symbol, i) => ({
    symbol,
    highlight: optionHighlights[i] ?? null
  }));

  const market = resolveUsMarketDayContext(new Date());

  return NextResponse.json({
    data: {
      market,
      indices,
      news,
      optionsGlance
    }
  });
}
