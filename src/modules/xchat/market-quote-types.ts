/** Shared shape for Yahoo quote JSON (Redis + API). Kept separate from `market-data.ts` to avoid cycles with Redis cache. */
export type MarketQuoteSnapshot = {
  symbol: string;
  currency?: string;
  shortName?: string;
  longName?: string;
  price?: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketState?: string;
  asOf?: string;
  source: "yahoo-finance2";
  disclaimer: string;
};
