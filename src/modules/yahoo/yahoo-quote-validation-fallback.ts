/**
 * Yahoo occasionally returns quote payloads that drift from yahoo-finance2's JSON schema.
 * The library throws `FailedYahooValidationError` (message contains "Failed validation" /
 * "QuoteResponseArray"). We retry once with `validateResult: false` so desk flows keep moving;
 * we still normalize defensively in {@link normalizeYahooBatchQuoteRow} / market-data mappers.
 *
 * @see https://github.com/gadicc/yahoo-finance2/blob/dev/docs/validation.md
 */

export function isYahooQuoteSchemaValidationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("FailedYahooValidationError") ||
    msg.includes("Failed validation") ||
    msg.includes("QuoteResponseArray") ||
    msg.includes("definitions/Quote")
  );
}

/**
 * `yahoo-finance2` `quote` is heavily overloaded; structural typing fights TS here.
 * Call sites pass the real `YahooFinance` instance from `getYahooFinance2()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function yahooQuoteWithValidationFallback(yf: any, query: string | string[], logLabel: string): Promise<unknown> {
  try {
    return await yf.quote(query, {}, { validateResult: false });
  } catch (e) {
    if (!isYahooQuoteSchemaValidationError(e)) {
      throw e;
    }
    const preview = Array.isArray(query) ? query.slice(0, 12) : query;
    console.warn(`[yahoo-finance2] ${logLabel} quote failed after validateResult:false`, {
      preview
    });
    throw e;
  }
}
