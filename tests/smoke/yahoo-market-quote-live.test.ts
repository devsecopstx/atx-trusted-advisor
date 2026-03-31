import { describe, expect, it } from "vitest";

import { getYahooMarketQuote } from "@/modules/xchat/market-data";

/**
 * Opt-in: hits real Yahoo via `yahoo-finance2` (network). CI skips unless env is set.
 * `RUN_YAHOO_MARKET_QUOTE_LIVE=true npm run test -- tests/smoke/yahoo-market-quote-live.test.ts`
 */
const runLive = process.env.RUN_YAHOO_MARKET_QUOTE_LIVE === "true";

describe.skipIf(!runLive)("getYahooMarketQuote live (SPY/QQQ)", () => {
  it("returns finite prices suitable for xChat comparison answers", async () => {
    const spy = await getYahooMarketQuote({ symbol: "SPY" });
    const qqq = await getYahooMarketQuote({ symbol: "QQQ" });
    expect(spy.symbol).toBe("SPY");
    expect(qqq.symbol).toBe("QQQ");
    expect(typeof spy.price).toBe("number");
    expect(typeof qqq.price).toBe("number");
    expect(spy.price).toBeGreaterThan(1);
    expect(qqq.price).toBeGreaterThan(1);
    expect(spy.source).toBe("yahoo-finance2");
    expect(qqq.source).toBe("yahoo-finance2");
  });
});
