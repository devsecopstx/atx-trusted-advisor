export type SymbolChartRangeId = "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "5y";

const ALLOWED: readonly SymbolChartRangeId[] = ["1d", "1w", "1m", "3m", "6m", "1y", "5y"];

export function parseSymbolChartRange(raw: string | null | undefined): SymbolChartRangeId {
  const r = (raw ?? "").trim().toLowerCase();
  return (ALLOWED as readonly string[]).includes(r) ? (r as SymbolChartRangeId) : "6m";
}

export type YahooChartWindow = {
  period1: Date;
  period2: Date;
  interval: "5m" | "15m" | "1d" | "1wk";
};

/** Maps UI range tabs to Yahoo Finance chart windows (intraday vs daily). */
export function resolveYahooChartWindow(range: SymbolChartRangeId, now = new Date()): YahooChartWindow {
  const period2 = new Date(now.getTime());
  const msDay = 24 * 60 * 60 * 1000;
  switch (range) {
    case "1d":
      return {
        period2,
        period1: new Date(period2.getTime() - 2 * msDay),
        interval: "5m"
      };
    case "1w":
      return {
        period2,
        period1: new Date(period2.getTime() - 10 * msDay),
        interval: "15m"
      };
    case "1m":
      return {
        period2,
        period1: new Date(period2.getTime() - 40 * msDay),
        interval: "1d"
      };
    case "3m":
      return {
        period2,
        period1: new Date(period2.getTime() - 100 * msDay),
        interval: "1d"
      };
    case "6m":
      return {
        period2,
        period1: new Date(period2.getTime() - 200 * msDay),
        interval: "1d"
      };
    case "1y":
      return {
        period2,
        period1: new Date(period2.getTime() - 400 * msDay),
        interval: "1d"
      };
    case "5y":
      return {
        period2,
        period1: new Date(period2.getTime() - 5 * 365 * msDay),
        interval: "1wk"
      };
  }
}

export const SYMBOL_CHART_RANGE_LABELS: Record<SymbolChartRangeId, string> = {
  "1d": "1D",
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  "5y": "5Y"
};
