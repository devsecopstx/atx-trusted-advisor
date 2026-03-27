import YahooFinance from "yahoo-finance2";

/**
 * YahooFinanceService (PLAN 260) — one configured `yahoo-finance2` client for quotes, options, and summaries.
 * Keeps `suppressNotices: ["yahooSurvey"]` so Cloud Run logs stay usable in prod.
 */
let singleton: InstanceType<typeof YahooFinance> | undefined;

export function getYahooFinance2(): InstanceType<typeof YahooFinance> {
  if (!singleton) {
    singleton = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
  }
  return singleton;
}
