import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Locks quote + rationale panel tabs and desk meta (status + % book risk). */
describe("watchlist quote detail panel contract", () => {
  const panelSrc = readFileSync(
    join(process.cwd(), "src/app/watchlist/ui/watchlist-quote-detail-panel.tsx"),
    "utf8"
  );

  it("exports quote and rationale tabs with desk meta fields", () => {
    expect(panelSrc).toContain('export type WatchlistQuotePanelTab = "quote" | "rationale" | "research"');
    expect(panelSrc).toContain("WatchlistResearchTab");
    expect(panelSrc).toContain("WatchlistQuotePanelDeskMeta");
    expect(panelSrc).toContain("<dt>Status</dt>");
    expect(panelSrc).toContain("<dt>% book risk</dt>");
    expect(panelSrc).toContain("xf-watchlist-quote-panel__tabs");
    expect(panelSrc).toContain("WatchlistQuoteRationaleTab");
  });

  it("blocks Active status without rationale and routes to rationale tab", () => {
    expect(panelSrc).toContain('next === "active"');
    expect(panelSrc).toContain('onTabChange("rationale")');
    expect(panelSrc).toContain("Open the Rationale tab in this panel");
  });

  it("remounts rationale editor state when symbol or rationale changes", () => {
    expect(panelSrc).toContain('key={`${row.symbol}:${row.rationale ?? ""}`}');
    expect(panelSrc).not.toContain("useEffect(() => {");
  });
});
