/**
 * Yahoo `chart()` payloads often drift from yahoo-finance2 JSON schema (e.g. null `meta.currency`).
 * We skip strict validation (`validateResult: false`) so desk flows do not log validation walls or throw.
 *
 * @see https://github.com/gadicc/yahoo-finance2/blob/devel/docs/validation.md
 */

/** Daily closes from a Yahoo chart payload (validated or raw). */
export function extractDailyClosesFromYahooChart(chart: unknown): number[] {
  if (typeof chart !== "object" || chart === null) {
    return [];
  }
  const quotes = (chart as { quotes?: unknown }).quotes;
  if (!Array.isArray(quotes)) {
    return [];
  }
  return quotes
    .map((row) => {
      if (typeof row !== "object" || row === null) {
        return null;
      }
      return (row as { close?: unknown }).close;
    })
    .filter((close): close is number => typeof close === "number" && Number.isFinite(close) && close > 0);
}

export async function yahooChartWithValidationFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yf: any,
  symbol: string,
  options: Record<string, unknown>,
  _logLabel: string
): Promise<unknown> {
  return await yf.chart(symbol, options, { validateResult: false });
}
