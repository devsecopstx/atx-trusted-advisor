import { getYahooBatchQuotes, marketQuoteHasLivePrice } from "@/modules/watchlist/yahoo-batch-quotes";
import { MARKET_DATA_DISCLAIMER } from "@/modules/xchat/market-data";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

export type SymbolResearchQuote = {
  symbol: string;
  companyName?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  bid?: number;
  bidSize?: number;
  ask?: number;
  askSize?: number;
  volume?: number;
  averageVolume?: number;
  open?: number;
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  trailingPe?: number;
  currency?: string;
};

export type SymbolResearchNewsItem = {
  title: string;
  link: string;
  publisher?: string;
  publishedAtLabel?: string;
};

export type SymbolResearchPayload = {
  quote: SymbolResearchQuote;
  news: SymbolResearchNewsItem[];
  asOf: string;
  disclaimer: string;
};

type YahooNewsRow = {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: number;
};

function toNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function toStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function formatSymbolResearchNewsTimestamp(epochSec: number | undefined): string | undefined {
  if (epochSec == null || !Number.isFinite(epochSec)) {
    return undefined;
  }
  const d = new Date(epochSec * 1000);
  if (!Number.isFinite(d.getTime())) {
    return undefined;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const month = pick("month").replace(".", "");
  const day = pick("day");
  const year = pick("year");
  const hour = pick("hour");
  const minute = pick("minute");
  const dayPeriod = pick("dayPeriod").toLowerCase();
  return `${month}-${day}-${year} ${hour}:${minute} ${dayPeriod}. ET`;
}

export function normalizeSymbolResearchNews(rows: YahooNewsRow[]): SymbolResearchNewsItem[] {
  const out: SymbolResearchNewsItem[] = [];
  for (const n of rows) {
    const title = toStr(n.title) ?? "";
    let link = toStr(n.link) ?? "";
    if (link.startsWith("/")) {
      link = `https://finance.yahoo.com${link}`;
    }
    if (!title || !link) {
      continue;
    }
    const publisher = toStr(n.publisher);
    const publishedAtLabel = formatSymbolResearchNewsTimestamp(n.providerPublishTime);
    out.push({ title, link, publisher, publishedAtLabel });
    if (out.length >= 12) {
      break;
    }
  }
  return out;
}

export async function fetchSymbolResearch(symbol: string): Promise<SymbolResearchPayload | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym || !/^[A-Z0-9.\-^]{1,15}$/.test(sym)) {
    return null;
  }

  const yf = getYahooFinance2();
  const [batchRows, rawQuote, searchRes] = await Promise.all([
    getYahooBatchQuotes([sym]),
    yf.quote(sym).catch(() => null),
    yf.search(sym, { newsCount: 12, quotesCount: 0 }).catch(() => ({ news: [] as YahooNewsRow[] }))
  ]);

  const batch = batchRows.find((r) => r.symbol.trim().toUpperCase() === sym);
  if (!batch || !marketQuoteHasLivePrice(batch)) {
    return null;
  }

  const raw = (rawQuote ?? {}) as Record<string, unknown>;
  const companyName = batch.shortName?.trim() || batch.longName?.trim() || sym;

  const quote: SymbolResearchQuote = {
    symbol: sym,
    companyName,
    price: batch.price,
    change: batch.change,
    changePercent: batch.changePercent,
    bid: toNum(raw.bid),
    bidSize: toNum(raw.bidSize),
    ask: toNum(raw.ask),
    askSize: toNum(raw.askSize),
    volume: batch.volume,
    averageVolume: toNum(raw.averageDailyVolume3Month) ?? toNum(raw.averageDailyVolume10Day),
    open: batch.open,
    previousClose: batch.previousClose,
    dayLow: batch.dayLow,
    dayHigh: batch.dayHigh,
    fiftyTwoWeekLow: batch.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: batch.fiftyTwoWeekHigh,
    trailingPe: toNum(raw.trailingPE)
  };

  const newsRaw = Array.isArray(searchRes.news) ? (searchRes.news as YahooNewsRow[]) : [];
  const news = normalizeSymbolResearchNews(newsRaw);

  return {
    quote,
    news,
    asOf: batch.asOf ?? new Date().toISOString(),
    disclaimer: MARKET_DATA_DISCLAIMER
  };
}
