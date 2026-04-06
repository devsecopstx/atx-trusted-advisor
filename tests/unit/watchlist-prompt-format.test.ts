import { describe, expect, it } from "vitest";

import {
    formatWatchlistAddedAtUtc,
    formatWatchlistTargetEntryNotional100xFromQuotePrice,
    formatWatchlistTargetEntryStored
} from "@/modules/xchat/watchlist-prompt-format";

describe("watchlist-prompt-format", () => {
  it("formats addedAt in UTC for display", () => {
    expect(formatWatchlistAddedAtUtc("2026-04-04T13:33:24.903Z")).toMatch(/Apr 4, 2026/);
    expect(formatWatchlistAddedAtUtc("2026-04-04T13:33:24.903Z")).toMatch(/UTC/);
  });

  it("formats stored target entry as USD or not set", () => {
    expect(formatWatchlistTargetEntryStored(undefined)).toBe("not set");
    expect(formatWatchlistTargetEntryStored(120.5)).toBe("$120.50");
    expect(formatWatchlistTargetEntryStored(0)).toBe("not set");
  });

  it("formats 100× quote notional like watchlist Target entry column", () => {
    expect(formatWatchlistTargetEntryNotional100xFromQuotePrice(undefined)).toBe("—");
    expect(formatWatchlistTargetEntryNotional100xFromQuotePrice(250.12)).toBe("25,012");
  });
});
