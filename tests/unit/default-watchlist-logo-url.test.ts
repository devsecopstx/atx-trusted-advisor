import { describe, expect, it } from "vitest";

import { defaultWatchlistLogoUrl } from "@/modules/watchlist/equity-logo-url";

describe("defaultWatchlistLogoUrl", () => {
  it("returns Fool CDN URL for equities", () => {
    expect(defaultWatchlistLogoUrl("tsla")).toBe(
      "https://g.foolcdn.com/art/companylogos/square/TSLA.png"
    );
    expect(defaultWatchlistLogoUrl("BRK.B")).toBe(
      "https://g.foolcdn.com/art/companylogos/square/BRK.B.png"
    );
  });

  it("uses OCC underlying for option tickers", () => {
    expect(defaultWatchlistLogoUrl("TSLA260412C00100000")).toBe(
      "https://g.foolcdn.com/art/companylogos/square/TSLA.png"
    );
  });

  it("returns undefined for empty or non-equity keys", () => {
    expect(defaultWatchlistLogoUrl("")).toBeUndefined();
    expect(defaultWatchlistLogoUrl("   ")).toBeUndefined();
    expect(defaultWatchlistLogoUrl("not a ticker!!!")).toBeUndefined();
  });
});
