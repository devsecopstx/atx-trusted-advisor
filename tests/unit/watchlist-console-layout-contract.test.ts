import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks watchlist desk shell: toolbar list control, quote panel, no legacy local sidebar. */
describe("watchlist console layout contract", () => {
  const consoleSrc = readFileSync(join(process.cwd(), "src/app/watchlist/ui/watchlist-console.tsx"), "utf8");
  const cssSrc = readFileSync(join(process.cwd(), "src/app/watchlist/watchlist.css"), "utf8");

  it("uses toolbar watchlist picker + create and quote/rationale side panel", () => {
    expect(consoleSrc).toContain("xf-watchlist-list-picker");
    expect(consoleSrc).toContain("New watchlist");
    expect(consoleSrc).toContain("WatchlistQuoteDetailPanel");
    expect(consoleSrc).toContain("View quote and rationale");
    expect(consoleSrc).toContain("portfolioTotalUsd={portfolioTotalUsd}");
    expect(consoleSrc).toContain("xf-watchlist-ops-note");
    expect(consoleSrc).toContain("onRefreshDeskQuotes");
    expect(consoleSrc).toContain("Refresh");
  });

  it("does not ship the legacy local watchlist sidebar", () => {
    expect(consoleSrc).not.toContain("xf-watchlist-sidebar");
    expect(consoleSrc).not.toContain("showLocalSidebar");
    expect(cssSrc).not.toContain(".xf-watchlist-sidebar");
  });

  it("enables compact desk grid below 1440px", () => {
    expect(consoleSrc).toContain('matchMedia("(max-width: 1439px)")');
    expect(consoleSrc).toContain("xf-watchlist-table-wrap--compact");
  });
});
