import { describe, expect, it, vi } from "vitest";

import {
    isYahooQuoteSchemaValidationError,
    yahooQuoteWithValidationFallback
} from "@/modules/yahoo/yahoo-quote-validation-fallback";

describe("yahooQuoteWithValidationFallback", () => {
  it("detects schema validation errors from message shape", () => {
    expect(isYahooQuoteSchemaValidationError(new Error("FailedYahooValidationError: Failed validation"))).toBe(true);
    expect(isYahooQuoteSchemaValidationError(new Error('Failed validation: #/definitions/QuoteResponseArray'))).toBe(
      true
    );
    expect(isYahooQuoteSchemaValidationError(new Error("ECONNRESET"))).toBe(false);
  });

  it("retries once with validateResult: false when validation fails", async () => {
    const quote = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed validation: #/definitions/QuoteResponseArray"))
      .mockResolvedValueOnce([{ symbol: "A", regularMarketPrice: 1 }]);
    const yf: { quote: typeof quote } = { quote };
    const out = await yahooQuoteWithValidationFallback(yf, ["A", "B"], "test");
    expect(quote).toHaveBeenCalledTimes(2);
    expect(quote.mock.calls[1]).toEqual([["A", "B"], {}, { validateResult: false }]);
    expect(out).toEqual([{ symbol: "A", regularMarketPrice: 1 }]);
  });

  it("does not retry on non-validation errors", async () => {
    const quote = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(yahooQuoteWithValidationFallback({ quote }, "X", "test")).rejects.toThrow("network down");
    expect(quote).toHaveBeenCalledTimes(1);
  });
});
