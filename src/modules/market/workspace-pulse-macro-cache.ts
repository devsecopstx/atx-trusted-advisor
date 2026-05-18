import { unstable_cache } from "next/cache";

import { summarizeNearestExpiryOptionsHighlight } from "@/modules/find-options/options-hot-scan";
import { resolveMacroQuotesWithSystemCache } from "@/modules/market/system-index-cache";
import { resolveUsMarketDayContext } from "@/modules/scanner/us-market-day-context";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

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

export type WorkspacePulseMacroSnapshot = {
  market: ReturnType<typeof resolveUsMarketDayContext>;
  indices: ReturnType<typeof serializeQuote>[];
  news: { title: string; link: string; publisher?: string }[];
};

const readWorkspacePulseMacroSnapshot = unstable_cache(
  async (): Promise<WorkspacePulseMacroSnapshot> => {
    const yf = getYahooFinance2();
    const [macroQuotes, searchRes] = await Promise.all([
      resolveMacroQuotesWithSystemCache(WORKSPACE_MACRO_INDICES),
      yf
        .search("US stock market", {
          newsCount: 6,
          quotesCount: 0
        })
        .catch(() => ({ news: [] as SearchNewsRow[] }))
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

    return {
      market: resolveUsMarketDayContext(new Date()),
      indices,
      news
    };
  },
  ["workspace-pulse-macro"],
  { revalidate: 120 }
);

export async function getWorkspacePulseMacroSnapshotCached(): Promise<WorkspacePulseMacroSnapshot> {
  return readWorkspacePulseMacroSnapshot();
}

export async function resolveWorkspacePulseOptionsGlance(symbols: string[]) {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{1,5}$/.test(s)))].slice(
    0,
    2
  );
  const highlights = await Promise.all(unique.map((sym) => summarizeNearestExpiryOptionsHighlight(sym)));
  return unique.map((symbol, i) => ({
    symbol,
    highlight: highlights[i] ?? null
  }));
}
