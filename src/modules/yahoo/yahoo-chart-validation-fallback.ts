/**
 * Yahoo `chart()` payloads occasionally fail yahoo-finance2 JSON schema validation (e.g. null `meta.currency`).
 * Retry once with `validateResult: false` — same pattern as {@link yahooQuoteWithValidationFallback}.
 */

export function isYahooChartSchemaValidationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("FailedYahooValidationError") ||
    msg.includes("Failed validation") ||
    msg.includes("ChartResultObject") ||
    msg.includes("definitions/Chart")
  );
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function yahooChartWithValidationFallback(
  yf: any,
  symbol: string,
  options: Record<string, unknown>,
  logLabel: string
): Promise<unknown> {
  try {
    return await yf.chart(symbol, options);
  } catch (e) {
    if (!isYahooChartSchemaValidationError(e)) {
      throw e;
    }
    console.warn(`[yahoo-finance2] ${logLabel} chart schema validation failed; retrying with validateResult: false`, {
      symbol
    });
    return await yf.chart(symbol, options, { validateResult: false });
  }
}
