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

function serializeQuote(sym: string, q: SymbolLookupResult | null | undefined) {
  if (!q) {
    return { symbol: sym, price: undefined as number | undefined, changePercent: undefined as number | undefined };
  }
  return {
    symbol: sym,
    price: q.price,
    changePercent: q.changePercent
  };
}

type SearchNewsRow = {
  title?: string;
  link?: string;
  publisher?: string;
};

/**
 * GET /api/market/workspace-pulse?holdings=TSLA,AAPL
 * Indices (SPY/QQQ), a few Yahoo search headlines, optional per-holding options IV/OI glance.
 */
export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  const { searchParams } = new URL(request.url);
  const holdings = parseHoldings(searchParams.get("holdings"));

  const yf = getYahooFinance2();

  const [spyQqq, searchRes, ...optionHighlights] = await Promise.all([
    lookupSymbols(["SPY", "QQQ"]),
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

  const indices = [
    serializeQuote("SPY", spyQqq.get("SPY")),
    serializeQuote("QQQ", spyQqq.get("QQQ"))
  ];

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
