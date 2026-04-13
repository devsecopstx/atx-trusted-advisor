import {
    isExpiredCallOption,
    parseOccOptionSymbol,
    todayEtYmd,
    underlyingForYahooOptionsChain
} from "@/modules/watchlist/option-expiration";
import { describe, expect, it } from "vitest";

function makeDateEt(ymd: string): Date {
  // Construct a Date corresponding to 12:00 in ET on the given ymd to avoid DST edges.
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  // 12:00 ET equals 17:00 UTC during standard time or 16:00 during DST, but we don't need exact.
  return new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
}

describe("option-expiration utils", () => {
  it("parses OCC symbols correctly", () => {
    const p = parseOccOptionSymbol("AAPL240419C00195000");
    expect(p).toBeTruthy();
    expect(p!.underlying).toBe("AAPL");
    expect(p!.expYmd).toBe("2024-04-19");
    expect(p!.optionType).toBe("call");
    expect(p!.strike).toBe(195);
  });

  it("treats expired call options as expired and calls expiring today as not expired (ET)", () => {
    const past = "TSLA240112C00100000"; // 2024-01-12 call
    const today = "TSLA260412C00100000"; // 2026-04-12 call
    const now = makeDateEt("2026-04-12");
    expect(isExpiredCallOption(past, now)).toBe(true);
    expect(isExpiredCallOption(today, now)).toBe(false);
  });

  it("maps OCC lines to underlying for Yahoo options chain", () => {
    expect(underlyingForYahooOptionsChain("aapl240419c00195000")).toBe("AAPL");
    expect(underlyingForYahooOptionsChain("TSLA")).toBe("TSLA");
    expect(underlyingForYahooOptionsChain("BRK.B")).toBe("BRK.B");
  });

  it("ignores non-call instruments and malformed symbols", () => {
    const put = "TSLA260412P00100000";
    const stock = "TSLA";
    const garbage = "TSLA2C";
    const now = makeDateEt(todayEtYmd());
    expect(isExpiredCallOption(put, now)).toBe(false);
    expect(isExpiredCallOption(stock, now)).toBe(false);
    expect(isExpiredCallOption(garbage, now)).toBe(false);
  });
});
