/** Public Yahoo Finance quote page (delayed data; same source family as yahoo-finance2). */
export const YAHOO_FINANCE_HOME_URL = "https://finance.yahoo.com/";

const TICKER_RE = /^[A-Z][A-Z0-9.\-^]{0,11}$/;

export function buildYahooFinanceQuoteUrl(symbol?: string): string {
  const sym = symbol?.trim().toUpperCase();
  if (!sym || !TICKER_RE.test(sym)) {
    return YAHOO_FINANCE_HOME_URL;
  }
  return `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
}

export function isYahooTickerSymbol(symbol: string): boolean {
  return TICKER_RE.test(symbol.trim().toUpperCase());
}
