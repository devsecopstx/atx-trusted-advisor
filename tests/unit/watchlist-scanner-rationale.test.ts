import { describe, expect, it } from "vitest";

import { buildWatchlistScannerRationaleAppendix } from "@/modules/watchlist/watchlist-scanner-rationale";

describe("buildWatchlistScannerRationaleAppendix", () => {
  it("uses appendix only when no prior rationale", () => {
    const at = new Date("2026-04-03T16:00:00.000Z");
    expect(buildWatchlistScannerRationaleAppendix(undefined, 190.12, at)).toBe(
      "[Watchlist price scan 2026-04-03] Spot $190.12 — review desk thesis."
    );
  });

  it("shows quote-unavailable when spot is undefined", () => {
    const at = new Date("2026-04-03T16:00:00.000Z");
    expect(buildWatchlistScannerRationaleAppendix(undefined, undefined, at)).toBe(
      "[Watchlist price scan 2026-04-03] Spot n/a (quote unavailable) — review desk thesis."
    );
  });

  it("appends after prior text", () => {
    const at = new Date("2026-04-03T16:00:00.000Z");
    expect(
      buildWatchlistScannerRationaleAppendix("Sell puts into strength.", 50, at)
    ).toBe(
      "Sell puts into strength.\n\n[Watchlist price scan 2026-04-03] Spot $50.00 — review desk thesis."
    );
  });

  it("truncates from the left when over 4000 chars", () => {
    const at = new Date("2026-04-03T16:00:00.000Z");
    const pad = "x".repeat(3950);
    const out = buildWatchlistScannerRationaleAppendix(pad, 1, at);
    expect(out.length).toBe(4000);
    expect(out).toContain("[Watchlist price scan 2026-04-03]");
    expect(out.endsWith("review desk thesis.")).toBe(true);
  });
});
