/** Lightweight sector labels for watchlist concentration (expand over time). */
const SYMBOL_SECTOR: Record<string, string> = {
  TSLA: "EV / Auto",
  NVDA: "Semis",
  AMD: "Semis",
  INTC: "Semis",
  AAPL: "Mega cap tech",
  MSFT: "Mega cap tech",
  GOOGL: "Mega cap tech",
  META: "Mega cap tech",
  AMZN: "Mega cap tech",
  RKLB: "Space / Aero",
  RDW: "Space / Aero",
  ASTS: "Space / Aero",
  PLTR: "Software / AI",
  COIN: "Fintech",
  JPM: "Financials",
  XOM: "Energy",
  GLD: "Commodities",
  SLV: "Commodities",
  IWM: "ETF / broad",
  SPY: "ETF / broad",
  QQQ: "ETF / tech"
};

export function getSymbolSectorLabel(symbol: string): string {
  const u = symbol.trim().toUpperCase();
  return SYMBOL_SECTOR[u] ?? "Other";
}
